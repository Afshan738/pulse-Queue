const { pool } = require("../database/pool");
const api_key_verification_middleWare = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) {
    return res.status(401).json({ error: "API key is missing" });
  }
  // Validating the API key format becasue we r sending this in base64 format and we need to make sure it is a valid hex string of length 64
  const apiKeyPattern = /^[a-f0-9]{64}$/;
  if (!apiKeyPattern.test(apiKey)) {
    return res.status(401).json({ error: "Invalid API key format" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE api_key=$1", [
      apiKey,
    ]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error("Error occurred while verifying API key:", error);
    next(error);
  }
};
module.exports = api_key_verification_middleWare;
