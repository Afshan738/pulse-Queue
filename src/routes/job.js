const express = require("express");
const router = express.Router();
const { pool } = require("../database/pool");
const idempotencyMiddleware = require("../middleware/idempotency");
const {
  validateJobInput,
  validateIdParam,
} = require("../middleware/inputValidation");
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM jobs`);
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});
router.post("/", idempotencyMiddleware, validateJobInput, async (req, res) => {
  try {
    const { user_id, payload } = req.body;
    const result = await pool.query(
      `INSERT INTO jobs(user_id, payload) VALUES($1, $2) RETURNING *`,
      [user_id, payload],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
router.get("/:id", validateIdParam, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM jobs WHERE id=$1`, [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
