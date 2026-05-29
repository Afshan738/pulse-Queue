require("dotenv").config({ path: "../.env" });
const express = require("express");
const app = express();
const errorHandler = require("./middleware/errorHandler");
app.use(express.json());

app.get("/", async (req, res) => {
  res.status(200).send("hello from pulse-Queue");

  console.log("pulse queue server is working successfully");
});
app.use("/api/users", require("./routes/user"));
app.use("/api/jobs", require("./routes/job"));
app.use(errorHandler);
app.listen(process.env.PORT || 8000, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
