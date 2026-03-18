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

  // Ensure bucket exists
  const bucketExists = await minio.bucketExists(config.MINIO_BUCKET);
  if (!bucketExists) {
    await minio.makeBucket(config.MINIO_BUCKET, "us-east-1");
    // Set bucket policy to private
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Deny",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${config.MINIO_BUCKET}/*`],
        },
      ],
    });
    await minio.setBucketPolicy(config.MINIO_BUCKET, policy);
  }

  fastify.decorate("minio", minio);
});
