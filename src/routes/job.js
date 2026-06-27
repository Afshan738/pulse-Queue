const express = require("express");
const router = express.Router();
const { pool } = require("../database/pool");
const idempotencyMiddleware = require("../middleware/idempotency");
const decodecursor = async (cursor) => {
  const decode = Buffer.from(cursor, "base64").toString("utf-8");
  const { id, created_at } = JSON.parse(decode);
  return { id, created_at };
};
const {
  validateJobInput,
  validateIdParam,
} = require("../middleware/inputValidation");
router.get("/", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || 10);
    const cursor = req.query.cursor;
    const decoded = cursor ? await decodecursor(cursor) : null;
    const cursorDate = decoded?.created_at
      ? new Date(parseInt(decoded.created_at))
      : null;
    let result;
    if (decoded) {
      result = await pool.query(
        `SELECT * FROM jobs WHERE created_at < $1 OR (created_at=$1 AND id<$2) ORDER BY created_at DESC, id DESC LIMIT $3`,
        [cursorDate, decoded?.id, limit + 1],
      );
    } else {
      result = await pool.query(
        `SELECT * FROM jobs ORDER BY created_at DESC, id DESC LIMIT $1`,
        [limit + 1],
      );
    }
    const hasMore = result.rows.length > limit ? true : false;
    if (hasMore) {
      result.rows.pop();
    }
    let encodedCursor = null;
    if (hasMore) {
      const lastJob = result.rows[result.rows.length - 1];
      encodedCursor = Buffer.from(
        JSON.stringify({
          id: lastJob.id,
          created_at: lastJob.created_at.getTime(),
        }),
      ).toString("base64");
    }
    res.status(200).json({
      data: result.rows,
      hasMore,
      nextCursor: hasMore ? encodedCursor : null,
    });
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
