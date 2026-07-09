const crypto = require("crypto");
const { client } = require("../database/redisClient");

const IDEMPOTENCY_TTL = 24 * 60 * 60; //ttl for idempotency key in seconds (24 hours) usually
// we can set it to 24 hours or more based on the use case

const idempotencyMiddleware = async (req, res, next) => {
  console.log("middleware hit — key:", req.headers["x-idempotency-key"]);
  if (req.method !== "POST") return next();

  const idempotencyKey = req.headers["x-idempotency-key"];
  if (!idempotencyKey) return next();

  const userId = req.body.user_id || "anonymous";
  const hash = crypto
    .createHash("sha256")
    .update(`${userId}:${idempotencyKey}`)
    .digest("hex");

  const cacheKey = `idempotency:${hash}`;

  try {
    const cachedResponse = await client.get(cacheKey);
    console.log("cache key:", cacheKey);
    console.log("cached response:", cachedResponse);

    if (cachedResponse) {
      const parsed = JSON.parse(cachedResponse);
      console.log("Idempotent request ...... returning cached response");
      return res.status(parsed.statusCode).json(parsed.body);
    }

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const toCache = {
        statusCode: res.statusCode,
        body: body,
      };
      client
        .setEx(cacheKey, IDEMPOTENCY_TTL, JSON.stringify(toCache))
        .catch((err) => console.error("Redis cache error:", err));
      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
};
module.exports=idempotencyMiddleware;
