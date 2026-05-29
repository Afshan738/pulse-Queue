const { Pool } = require("pg");
require("dotenv").config({ path: "../../.env" });
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5434,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 70000,
  connectionTimeoutMillis: 5000,
});

// pool.query("SELECT NOW()", (err, res) => {
//   if (err) console.error("DB connection failed:", err);
//   else console.log("DB connected at:", res.rows[0].now);
// });
module.exports = { pool };
