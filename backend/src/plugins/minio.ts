import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { Client as MinioClient } from "minio";
import { config } from "../config";

declare module "fastify" {
  interface FastifyInstance {
    minio: MinioClient;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const minio = new MinioClient({
    endPoint: config.MINIO_ENDPOINT,
    port: config.MINIO_PORT,
    useSSL: config.MINIO_USE_SSL,
    accessKey: config.MINIO_ACCESS_KEY,
    secretKey: config.MINIO_SECRET_KEY,
  });

  // Ensure bucket exists. No public bucket policy is set — the bucket is
  // private by default. Objects are accessed exclusively via presigned URLs
  // signed with the root credentials, which bypass the need for any policy.
  const bucketExists = await minio.bucketExists(config.MINIO_BUCKET);
  if (!bucketExists) {
    await minio.makeBucket(config.MINIO_BUCKET, "us-east-1");
  }

  fastify.decorate("minio", minio);
});
