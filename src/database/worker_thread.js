const { workerData, parentPort } = require("worker_threads");
const process_job = async (job) => {
  const { urls } = job;
  const results = [];
  let allSuccessful = true;

  for (let j = 0; j < urls.length; j++) {
    const response = await fetch(urls[j]);
    if (response.ok) {
      results.push({
        url: urls[j],
        status: "success",
        statusCode: response.status,
      });
    } else {
      allSuccessful = false;
      results.push({
        url: urls[j],
        status: "failed",
        statusCode: response.status,
      });
    }
  }
  return { allSuccessful, results, jobId: workerData.jobId };
};
(async () => {
  const result = await process_job(workerData);
  parentPort.postMessage(result);
})();
