const express = require("express");
const router = express.Router();
const { pool } = require("./database/pool");
const crypto = require("crypto");
const api_key = crypto.randomBytes(32).toString("hex");
router.post("/register", async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO users(api_key,user_name) VALUES($1,$2) RETURNING *`,
      [api_key, req.body.user_name],
    );
    res.status(201).json(result.rows[0]);

    console.log("user registered successfully");
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
module.exports = router;
