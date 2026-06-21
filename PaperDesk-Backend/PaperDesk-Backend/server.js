import "./config/env.js";

import cluster from "cluster";
import { cpus } from "os";
import app from "./app.js";
import { startReminderService } from "./services/reminderService.js";

const WORKER_COUNT = Math.min(cpus().length, 4);
const port = process.env.PORT || 5000;
const host = "0.0.0.0";

if (cluster.isPrimary) {
  console.log(`PaperDesk primary process ${process.pid} starting ${WORKER_COUNT} workers.`);

  for (let i = 0; i < WORKER_COUNT; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} exited. Restarting...`);
    cluster.fork();
  });
} else {
  app.listen(port, host, () => {
    console.log(`PaperDesk worker ${process.pid} running on ${host}:${port}`);
  });

  // Start the reminder service in worker #1 only so only one instance
  // sends reminder emails regardless of how many cluster workers are running.
  if (cluster.worker?.id === 1) {
    startReminderService();
  }
}
