const express = require("express");
const router = express.Router();
const { pool } = require("../database/pool");
const crypto = require("crypto");
const api_key_verification_middleWare = require("../middleware/apiKeyAuth");
const {
  validateUserInput,
  validateIdParam,
} = require("../middleware/inputValidation");

router.post("/register", validateUserInput, async (req, res, next) => {
  try {
    const api_key = crypto.randomBytes(32).toString("hex");
    const result = await pool.query(
      `INSERT INTO users(api_key,user_name) VALUES($1,$2) RETURNING *`,
      [api_key, req.body.user_name],
    );
    console.log("user registered successfully");
    res.status(201).json({
      user_name: result.rows[0].user_name,
      api_key: result.rows[0].api_key,
      message: "Save your API key. It will not be shown again.",
    });
  } catch (error) {
    next(error);
  }
});

router.delete(
  "/:id",
  api_key_verification_middleWare,
  validateIdParam,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `DELETE FROM users WHERE id = $1 RETURNING *`,
        [req.params.id],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res
        .status(200)
        .json({ message: "User deleted successfully", id: result.rows[0].id });
    } catch (error) {
      next(error);
    }
  },
);
module.exports = router;
