const crypto = require("crypto");

const createError = (code, message, field = null) => {
  const uuid = crypto.randomUUID();
  return {
    error: {
      code,
      message,
      field,
      requestId: uuid,
    },
  };
};

const errorHandler = (err, req, res, next) => {
  res.status(500).json(createError("INTERNAL_ERROR", err.message));
};

module.exports = { createError, errorHandler };
