# PulseQueue
 
A production-grade idempotent job queue built with Node.js, Express, PostgreSQL, and Redis. PulseQueue solves a real problem: when distributed workers process jobs concurrently, how do you guarantee a job runs exactly once — no duplicate emails, no double charged payments, no lost work when a worker crashes mid-task.
 
## The Problem
 
Distributed job processing systems commonly fail in three ways:
 
1. **Duplicate requests**: a client retries a request (network timeout, double-click) and the same job gets created and processed twice
2. **Duplicate processing** : multiple workers pick up the same pending job simultaneously and both process it
3. **Lost jobs on crash**: a worker dies mid-processing and the job is stuck forever, never retried
PulseQueue addresses all three with request-level idempotency, database-level locking, and automatic stuck-job recovery.
 
## Architecture
 
<img width="1280" height="698" alt="image" src="https://github.com/user-attachments/assets/cae902c2-b2f9-44b4-b71f-5b440fc97655" />

 
## Key Design Decisions
 
### Why PostgreSQL advisory locks over row-level locks
 
Row-level locks (`SELECT ... FOR UPDATE`) tie up a database transaction for the duration of the work, which is dangerous when "the work" includes network calls that can take seconds. Advisory locks are application-level and non-blocking — `pg_try_advisory_lock(job.id)` returns instantly with `true` or `false`, letting a worker move on to the next job immediately if another worker already owns the current one. No worker ever blocks waiting on another.
 
### Why cursor-based pagination over offset pagination
 
`OFFSET` pagination degrades linearly with page depth — fetching page 1000 means scanning and discarding the first 9990 rows. It's also unstable: if a row is inserted while a user is paginating, results shift and duplicate or skip entries. Cursor pagination anchors to a specific row position `(created_at, id)`, so performance stays constant regardless of page depth, and new inserts never disturb an in-progress pagination sequence.
 
### Why a composite `(created_at, id)` cursor instead of `created_at` alone
 
`created_at` is not guaranteed unique — two jobs can be created in the same millisecond under load. Using `id` as a tiebreaker guarantees a strictly total order, making the cursor deterministic with zero risk of skipped or duplicated rows at timestamp collisions.
 
### Why worker threads for URL health checks
 
The scheduler may process jobs containing many URLs. Sequential `await fetch()` calls inside the main thread's call stack hold up that execution context, delaying how quickly Express can respond to other incoming HTTP requests. Worker threads run on a separate V8 instance with their own event loop, so health-check processing never competes with the main thread for CPU time. The main thread stays free to accept new HTTP connections and continue scheduling.
 
### Why `updated_at` (not `completed_at`) detects stuck jobs
 
`completed_at` is `NULL` until a job finishes, so it can't measure how long a job has been *in progress*. A PostgreSQL trigger stamps `updated_at = NOW()` on every row update, including the transition to `processing`. If a worker crashes after that point, `updated_at` simply stops advancing — the scheduler detects any job in `processing` with a stale `updated_at` and resets it to `pending` automatically, with zero manual intervention.
 
### Why idempotency uses SHA-256 fingerprinting + Redis, not a database unique constraint
 
A database constraint can only dedupe on values already stored in a row. Idempotency needs to dedupe on the *entire incoming request* before it touches the database at all — including requests that would otherwise create different rows. SHA-256 fingerprinting the request body, combined with a 24-hour Redis TTL cache of the response, lets PulseQueue return the exact original response to a retried request without ever re-executing the side effect.
 
## Performance: Query Optimization
 
The pagination query initially used an OR-based WHERE clause, the most intuitive way to express "rows after this cursor position":
 
```sql
WHERE created_at < $1 OR (created_at = $1 AND id < $2)
```
 
Tested against 7,000+ seeded rows with the composite index `(created_at DESC, id DESC)` in place:
 
```
Limit  (actual time=21.861..21.865 rows=10 loops=1)
  ->  Index Scan using idx_jobs_created_at_id on jobs
        Filter: ((created_at < ...) OR ((created_at = ...) AND (id < ...)))
        Rows Removed by Filter: 3501
Execution Time: 22.029 ms
```
 
Despite using the index to scan, PostgreSQL still evaluated the OR condition as a row-by-row **Filter** *after* the index scan — manually checking and discarding 3,501 rows before finding the 10 needed.
 
Rewriting the same logic using PostgreSQL's row value comparison syntax:
 
```sql
WHERE (created_at, id) < ($1, $2)
```
 
```
Limit  (actual time=1.362..1.372 rows=10 loops=1)
  ->  Index Scan using idx_jobs_created_at_id on jobs
        Index Cond: (ROW(created_at, id) < ROW($1, $2))
Execution Time: 6.045 ms
```
 
This version compiles to an **Index Cond** rather than a **Filter** — PostgreSQL uses the composite index to jump directly to the correct starting position in the B-tree rather than scanning and filtering. Result: **22.029ms → 6.045ms, a 3.6x improvement**, with the gap widening further as the table grows.
 
### Indexes
 
```sql
-- Partial index: only indexes pending jobs, since that's the scheduler's only query target
CREATE INDEX idx_jobs_status_pending ON jobs (status) WHERE status = 'pending';
 
-- Composite index matching the cursor pagination sort order exactly
CREATE INDEX idx_jobs_created_at_id ON jobs (created_at DESC, id DESC);
```
 
The partial index on `status` avoids indexing `completed` and `failed` jobs entirely — the scheduler never queries for those, so there's no reason to pay the storage and write-amplification cost of indexing them.
 
## API Reference
 
### `POST /api/users/register`
Creates a user and returns an API key. No authentication required — this is the only public endpoint.
 
```bash
curl -X POST http://localhost:8000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"user_name": "afshan"}'
```
 
### `POST /api/jobs`
Creates a job. Requires `x-api-key` header. Idempotent — identical requests within 24 hours return the cached original response.
 
### `GET /api/jobs`
Cursor-paginated job listing.
 
| Query Param | Description |
|---|---|
| `limit` | Jobs per page (default 10) |
| `cursor` | Base64-encoded `{id, created_at}` from previous page's `nextCursor` |
 
```json
{
  "data": [...],
  "hasMore": true,
  "nextCursor": "eyJpZCI6NzAyNSwi..."
}
```
 
### `GET /api/jobs/:id`
Fetch a single job by ID.
 
### `DELETE /api/users/:id`
Deletes a user and cascades to their jobs. Requires `x-api-key` header.
 
### `GET /health`
No authentication required.
 
```json
{
  "status": "ok",
  "eventLoopLag": "2ms",
  "queueDepth": 0,
  "dbConnections": { "total": 2, "idle": 2, "waiting": 0 },
  "memory": { "heapUsed": "25MB", "heapTotal": "52MB", "rss": "75MB" }
}
```
 
## Tech Stack
 
Node.js · Express · PostgreSQL · Redis · Docker · `worker_threads` · `pg_try_advisory_lock`
 
## Running Locally
 
```bash
docker-compose up -d        # PostgreSQL + Redis
node src/database/seed.js   # creates a test user + sample jobs
node src/index.js           # starts the server on :8000
```
 
## What This Project Demonstrates
 
- Idempotent API design preventing duplicate side effects under retries
- Distributed locking with PostgreSQL advisory locks, avoiding duplicate job processing across concurrent workers
- Stable, performant pagination at scale using cursor-based navigation backed by a matching composite index
- CPU-isolation via Node.js worker threads, keeping the main event loop responsive under load
- Production observability via a `/health` endpoint exposing event loop lag, queue depth, connection pool state, and memory usage
- Query optimization backed by `EXPLAIN ANALYZE`, not guesswork

 *The idempotency and locking patterns here apply directly to any system where duplicate processing has real cost, a payment charged twice, an investor emailed twice, a webhook delivered twice. PulseQueue is the backend pattern, not the product.*
