const { createClient } = require("redis");
require("dotenv").config({ path: "../.env" });
const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6380,
  },
});

client.on("error", (err) => {
  console.log(`The error while connecting the redis ${err}`);
});
client.on("connect", () => {
  console.log(
    "redis is connected successfully on port" + process.env.REDIS_PORT,
  );
});

module.exports = { client };
