require("dotenv").config({ path: "../.env" });

const express = require("express");
const app = express();
const { client } = require("./database/redisClient");
const { errorHandler } = require("./middleware/errorHandler");
const api_key_verification_middleWare = require("./middleware/apiKeyAuth");
app.use(express.json());

app.get("/", async (req, res) => {
  res.status(200).send("hello from pulse-Queue");

  console.log("pulse queue server is working successfully");
});
app.use("/api/users", require("./routes/user"));
app.use("/api/jobs", api_key_verification_middleWare, require("./routes/job"));

app.use(errorHandler);
const startServer = async () => {
  await client.connect();
  app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });
};

startServer().catch((err) => console.error("Server failed to start:", err));
