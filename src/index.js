require("dotenv").config({ path: "../.env" });

const express = require("express");
const { pool } = require("./database/pool");
const app = express();
const { client } = require("./database/redisClient");
const { errorHandler } = require("./middleware/errorHandler");
const api_key_verification_middleWare = require("./middleware/apiKeyAuth");
app.use(express.json());

app.get("/", async (req, res) => {
  res.status(200).send("hello from pulse-Queue");
  console.log("pulse queue server is working successfully");
});
app.get("/health", async (req, res) => {
  try {
    const pending_jobs = await pool.query(
      `select count(status) from jobs where status='pending'`,
    );
    const dbConnections = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    };
    const memory = {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    };
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const lag = Date.now() - start;

    res.status(200).json({
      status: "ok",
      eventLoopLag: `${lag}ms`,
      queueDepth: parseInt(pending_jobs.rows[0].count),
      dbConnections,
      memory,
    });
  } catch (e) {
    console.log("error while fetching the pending jobs");
  }
});
app.use("/api/users", require("./routes/user"));
app.use("/api/jobs", api_key_verification_middleWare, require("./routes/job"));

app.use(errorHandler);
const startServer = async () => {
  await client.connect();
  require("./database/scheduler");
  console.log("Scheduler started");
  app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });
};

startServer().catch((err) => console.error("Server failed to start:", err));
