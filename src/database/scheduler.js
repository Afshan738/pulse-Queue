const { pool } = require("../database/pool");
const { Worker } = require("worker_threads");
const path = require("path");
const Job_recovery = async () => {
  try {
    await pool.query(
      `Update jobs set status='pending' where status='processing' and updated_at < NOW() - INTERVAL '5 minutes'`,
    );
  } catch (e) {
    console.error("Error occurred while recovering jobs:", e);
  }
};

const job_processing = async () => {
  try {
    const result = await pool.query(
      `select  id,type,payload,status from jobs where status='pending' order by created_at asc`,
    );
    if (result.rows.length > 0) {
      // Processing the pending jobs
      const healthCheck = result.rows.filter(
        (job) => job.type === "health-check",
      );
      if (healthCheck.length > 0) {
        for (let i = 0; i < healthCheck.length; i++) {
          const lockResult = await pool.query(
            `SELECT pg_try_advisory_lock($1)`,
            [healthCheck[i].id],
          );
          const acquired = lockResult.rows[0].pg_try_advisory_lock;
          if (!acquired) continue;
          await pool.query(`UPDATE jobs SET status='processing' WHERE id=$1`, [
            healthCheck[i].id,
          ]);
          const urls = healthCheck[i].payload.urls;
          const worker = new Worker(
            path.join(__dirname, "./worker_thread.js"),
            {
              workerData: { jobId: healthCheck[i].id, urls },
            },
          );
          worker.on("message", async (data) => {
            const { allSuccessful, results, jobId } = data;
            try {
              if (allSuccessful) {
                await pool.query(
                  `UPDATE jobs SET status='completed', result=$1, completed_at=NOW() WHERE id=$2`,
                  [JSON.stringify({ results }), jobId],
                );
                console.log(results);
              } else {
                await pool.query(
                  `UPDATE jobs SET status='failed', result=$1 WHERE id=$2`,
                  [JSON.stringify({ results }), jobId],
                );
                console.log(results);
              }
            } catch (e) {
              console.error("Error occurred while updating job status:", e);
            }
          });
          worker.on("error", (err) => {
            console.error("Worker error:", err);
          });
          worker.on("exit", (code) => {
            console.log(`Worker exited with code ${code}`);
          });
        }
      }
    }
  } catch (e) {
    console.error("Error occurred while fetching pending jobs:", e);
  }
};
Job_recovery();
job_processing();
setInterval(
  async () => {
    await Job_recovery();
    await job_processing();
  },
  1 * 60 * 1000,
);
