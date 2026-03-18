import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import Redis from "ioredis";
import { config } from "../config";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  await redis.connect();

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
});
