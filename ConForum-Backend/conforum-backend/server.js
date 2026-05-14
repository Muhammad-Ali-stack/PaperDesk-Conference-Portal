import "./config/env.js";

import cluster from "cluster";
import { cpus } from "os";
import app from "./app.js";

const WORKER_COUNT = Math.min(cpus().length, 4);
const port = process.env.PORT || 8080;

if (cluster.isPrimary) {
  console.log(`ConForum primary process ${process.pid} starting ${WORKER_COUNT} workers.`);

  for (let i = 0; i < WORKER_COUNT; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} exited. Restarting...`);
    cluster.fork();
  });
} else {
  app.listen(port, () => {
    console.log(`ConForum worker ${process.pid} running on port ${port}`);
  });
}
