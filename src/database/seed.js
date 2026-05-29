const crypto = require("crypto");
const user_name = "test_user";

const api_key = crypto.randomBytes(32).toString("hex");
const { pool } = require("./pool");

const seed_user = async () => {
  try {
    await pool.query(
      "INSERT INTO users (user_name,api_key) VALUES ($1, $2) ON CONFLICT (user_name) DO NOTHING",
      [user_name, api_key],
    );
    console.log("User seeded successfully");
    console.log("Your API key:", api_key);
  } catch (err) {
    console.error("Error occurred while seeding the database:", err);
  }
};
seed_user();
const jobdata = {
  urls: ["github.com", "google.com"],
};
const seed_jobData = async () => {
  try {
    const results = await pool.query(
      "INSERT INTO jobs(user_id,payload ) VALUES($1,$2)",
      [1, jobdata],
    );
    console.log("Job data seeded successfully");
  } catch (err) {
    console.error("Error occurred while seeding the database:", err);
  }
};
seed_jobData();
await pool.end();
