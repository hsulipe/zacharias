import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./config";
import postgresPlugin from "./plugins/postgres";
import minioPlugin from "./plugins/minio";
import redisPlugin from "./plugins/redis";
import { authRoutes } from "./modules/auth/auth.routes";
import { documentRoutes } from "./modules/documents/documents.routes";
import { metadataRoutes } from "./modules/metadata/metadata.routes";
import { auditRoutes } from "./modules/audit/audit.routes";
import { groupRoutes } from "./modules/groups/groups.routes";
import { processTypeRoutes } from "./modules/process/process.routes";
import { deadlineRoutes } from "./modules/deadlines/deadlines.routes";
import { annotationRoutes } from "./modules/annotations/annotations.routes";
import { startExpiryCron } from "./modules/expiry/expiry.service";
import { startDeadlineCron } from "./modules/deadlines/deadlines.service";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "warn" : "info",
    },
    trustProxy: true,
  });

  // Security
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // JWT
  await app.register(jwt, {
    secret: config.JWT_SECRET,
  });

  // File uploads
  await app.register(multipart, {
    limits: {
      fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024,
      files: 1,
    },
  });

  // OpenAPI docs
  if (config.NODE_ENV !== "production") {
    await app.register(swagger, {
      openapi: {
        info: { title: "GED API", version: "1.0.0", description: "Electronic Document Management System" },
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          },
        },
      },
    });
    await app.register(swaggerUi, { routePrefix: "/docs" });
  }

  // Plugins
  await app.register(postgresPlugin);
  await app.register(minioPlugin);
  await app.register(redisPlugin);

  // Routes
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(documentRoutes, { prefix: "/documents" });
  await app.register(metadataRoutes, { prefix: "/documents" });
  await app.register(deadlineRoutes, { prefix: "/documents" });
  await app.register(annotationRoutes, { prefix: "/documents" });
  await app.register(auditRoutes, { prefix: "/audit" });
  await app.register(groupRoutes, { prefix: "/groups" });
  await app.register(processTypeRoutes, { prefix: "/process-types" });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  return app;
}

async function start() {
  const app = await buildApp();

  // Start crons
  startExpiryCron(app.db);
  startDeadlineCron(app.db);

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`GED API running on ${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
