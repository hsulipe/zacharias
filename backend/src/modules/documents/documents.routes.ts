import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { JwtPayload } from "../../types";
import {
  createDocument,
  getDocumentById,
  listDocuments,
  softDeleteDocument,
  updateDocumentExpiry,
  getPresignedDownloadUrl,
} from "./documents.service";
import { logAudit } from "../audit/audit.service";
import { ocrQueue } from "../../workers/ocr.queue";
import { config } from "../../config";

const ALLOWED_MIME_TYPES = ["application/pdf"];
const MAX_FILE_SIZE = config.MAX_FILE_SIZE_MB * 1024 * 1024;

export async function documentRoutes(fastify: FastifyInstance) {
  // POST /documents — upload
  fastify.post(
    "/",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const user = request.user as JwtPayload;

      const data = await request.file();
      if (!data) return reply.code(400).send({ error: "No file provided" });

      if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
        return reply.code(415).send({ error: "Only PDF files are accepted" });
      }

      const fileBuffer = await data.toBuffer();
      if (fileBuffer.length > MAX_FILE_SIZE) {
        return reply.code(413).send({ error: `File exceeds ${config.MAX_FILE_SIZE_MB}MB limit` });
      }

      const titleField = data.fields?.title as { value: string } | undefined;
      const expiresAtField = data.fields?.expires_at as { value: string } | undefined;
      const title = titleField?.value ?? data.filename;
      const expiresAt = expiresAtField?.value ? new Date(expiresAtField.value) : undefined;

      const doc = await createDocument(fastify.db, {
        title,
        filename: data.filename,
        mime_type: data.mimetype,
        size: fileBuffer.length,
        uploader_id: user.sub,
        expires_at: expiresAt,
        fileBuffer,
        minio: fastify.minio,
      });

      // Enqueue OCR job
      await ocrQueue.add("ocr", { documentId: doc.id, storageKey: doc.storage_key });

      await logAudit(fastify.db, {
        document_id: doc.id,
        user_id: user.sub,
        action: "document.upload",
        ip: request.ip,
        metadata: { filename: doc.filename, size: doc.size },
      });

      return reply.code(201).send({ document: doc });
    }
  );

  // GET /documents — list
  fastify.get("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const query = z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query);

    const result = await listDocuments(fastify.db, query);
    return reply.send(result);
  });

  // GET /documents/:id — get one
  fastify.get("/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;

    const doc = await getDocumentById(fastify.db, id);
    if (!doc) return reply.code(404).send({ error: "Document not found" });

    await logAudit(fastify.db, {
      document_id: doc.id,
      user_id: user.sub,
      action: "document.view",
      ip: request.ip,
    });

    return reply.send({ document: doc });
  });

  // GET /documents/:id/download — presigned URL
  fastify.get("/:id/download", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;

    const doc = await getDocumentById(fastify.db, id);
    if (!doc) return reply.code(404).send({ error: "Document not found" });

    const url = await getPresignedDownloadUrl(fastify.minio, doc.storage_key, doc.filename);

    await logAudit(fastify.db, {
      document_id: doc.id,
      user_id: user.sub,
      action: "document.download",
      ip: request.ip,
    });

    return reply.send({ url, expires_in: 3600 });
  });

  // PATCH /documents/:id/expiry
  fastify.patch(
    "/:id/expiry",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as JwtPayload;
      const { expires_at } = z
        .object({ expires_at: z.string().datetime().nullable() })
        .parse(request.body);

      try {
        const doc = await updateDocumentExpiry(
          fastify.db,
          id,
          expires_at ? new Date(expires_at) : null
        );
        await logAudit(fastify.db, {
          document_id: doc.id,
          user_id: user.sub,
          action: "document.expiry.update",
          ip: request.ip,
          metadata: { expires_at },
        });
        return reply.send({ document: doc });
      } catch (err: any) {
        if (err.message === "DOCUMENT_NOT_FOUND") return reply.code(404).send({ error: "Document not found" });
        throw err;
      }
    }
  );

  // DELETE /documents/:id
  fastify.delete(
    "/:id",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as JwtPayload;

      const doc = await getDocumentById(fastify.db, id);
      if (!doc) return reply.code(404).send({ error: "Document not found" });

      await softDeleteDocument(fastify.db, id);

      await logAudit(fastify.db, {
        document_id: doc.id,
        user_id: user.sub,
        action: "document.delete",
        ip: request.ip,
      });

      return reply.code(204).send();
    }
  );
}
