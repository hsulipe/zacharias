import { Queue } from "bullmq";
import { config } from "../config";

export const ocrQueue = new Queue("ocr", {
  connection: { url: config.REDIS_URL },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
