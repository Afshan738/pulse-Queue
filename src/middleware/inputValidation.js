const { z } = require("zod");
const { createError } = require("./errorHandler");
//user validation schema
const userSchema = z.object({
  api_key: z
    .string()
    .length(44)
    .regex(/^[a-f0-9]+$/),
  user_name: z.string(),
});

//job validation schema
const jobSchema = z.object({
  user_id: z.number().int().positive(),
  payload: z.object({
    urls: z.array(z.string().url()).min(1, "At least one URL is required"),
  }),
  type: z.enum(["health-check", "email", "report", "webhook"]),
});

// id validation middleware
const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});
const validateIdParam = (req, res, next) => {
  const result = idParamSchema.safeParse({ id: req.params.id });
  if (!result.success) {
    const errorResponse = createError(
      "VALIDATION_ERROR",
      "Invalid ID format",
      "id",
    );
    return res.status(422).json(errorResponse);
  }
  req.params.id = result.data.id;
  next();
};

const validateUserInput = (req, res, next) => {
  const result = userSchema.safeParse(req.body);
  if (!result.success) {
    const error = result.error.errors || result.error.issues;
    const firstError = error[0];
    const errorResponse = createError(
      "VALIDATION_ERROR",
      firstError.message,
      firstError.path.join("."),
    );
    return res.status(422).json(errorResponse);
  }
  next();
};
const validateJobInput = (req, res, next) => {
  const result = jobSchema.safeParse(req.body);
  if (!result.success) {
    const error = result.error.errors || result.error.issues;
    const firstError = error[0];
    const errorResponse = createError(
      "VALIDATION_ERROR",
      firstError.message,
      firstError.path.join("."),
    );
    return res.status(422).json(errorResponse);
  }
  next();
};
module.exports = { validateUserInput, validateJobInput, validateIdParam };
