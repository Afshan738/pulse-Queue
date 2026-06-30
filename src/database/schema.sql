
CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    api_key text not null unique,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE jobs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id),
    type        TEXT NOT NULL DEFAULT 'health-check',
    payload     JSONB NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    result      JSONB,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_status_pending ON jobs (status) WHERE status = 'pending';
CREATE INDEX idx_jobs_created_at_id ON jobs (created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Trigger to update the updated_at column on jobs table whenever a row is updated
CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();