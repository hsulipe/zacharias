import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { JwtPayload } from "../../types";
import {
  createDocument,
  getDocumentById,
  listDocuments,
  getDocumentFacets,
  softDeleteDocument,
  updateDocumentExpiry,
  updateDocumentAssignedTo,
  getPresignedDownloadUrl,
  getPresignedViewUrl,
} from "./documents.service";
import {
  assignDocumentToGroup,
  removeDocumentFromGroup,
  getDocumentGroups,
} from "../groups/groups.service";
import {
  assignProcessType,
  transitionDocumentState,
  getProcessHistory,
  validateDocumentSchema,
} from "../process/process.service";
import { logAudit } from "../audit/audit.service";
import { ocrQueue } from "../../workers/ocr.queue";
import { config } from "../../config";

const ALLOWED_MIME_TYPES = ["application/pdf"];
const MAX_FILE_SIZE = config.MAX_FILE_SIZE_MB * 1024 * 1024;

export async function documentRoutes(fastify: FastifyInstance) {
  // GET /documents/facets — MUST be before /:id
  fastify.get("/facets", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const facets = await getDocumentFacets(fastify.db, { userId: user.sub, userRole: user.role });
    return reply.send({ facets });
  });

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

  // GET /documents — list with extended filters
  fastify.get("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const query = z.object({
      search: z.string().optional(),
      process_type_id: z.string().uuid().optional(),
      current_state_id: z.string().uuid().optional(),
      assigned_to: z.string().uuid().optional(),
      due_from: z.string().optional(),
      due_to: z.string().optional(),
      tag: z.union([z.string(), z.array(z.string())]).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query);

    // Parse meta[key]=value filters
    const rawQuery = request.query as Record<string, string>;
    const meta: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawQuery)) {
      const match = k.match(/^meta\[(.+)\]$/);
      if (match) meta[match[1]] = v;
    }

    const result = await listDocuments(fastify.db, {
      userId: user.sub,
      userRole: user.role,
      ...query,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    });
    return reply.send(result);
  });

  // GET /documents/:id — get one
  fastify.get("/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;

    const doc = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
    if (!doc) return reply.code(404).send({ error: "Document not found" });

    await logAudit(fastify.db, {
      document_id: doc.id,
      user_id: user.sub,
      action: "document.view",
      ip: request.ip,
    });

    // Include groups and schema if process type is set
    const groups = await getDocumentGroups(fastify.db, doc.id);
    return reply.send({ document: doc, groups });
  });

  // GET /documents/:id/download — presigned download URL
  fastify.get("/:id/download", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;

    const doc = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
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

  // GET /documents/:id/view — presigned inline view URL (for PDF.js)
  fastify.get("/:id/view", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;

    const doc = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
    if (!doc) return reply.code(404).send({ error: "Document not found" });

    const url = await getPresignedViewUrl(fastify.minio, doc.storage_key);
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

      const existing = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
      if (!existing) return reply.code(404).send({ error: "Document not found" });

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

  // PATCH /documents/:id/assign — assign to user
  fastify.patch(
    "/:id/assign",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as JwtPayload;
      const { assigned_to } = z
        .object({ assigned_to: z.string().uuid().nullable() })
        .parse(request.body);

      const existing = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
      if (!existing) return reply.code(404).send({ error: "Document not found" });

      try {
        const doc = await updateDocumentAssignedTo(fastify.db, id, assigned_to);
        return reply.send({ document: doc });
      } catch (err: any) {
        if (err.message === "DOCUMENT_NOT_FOUND") return reply.code(404).send({ error: "Document not found" });
        throw err;
      }
    }
  );

  // PATCH /documents/:id/process-type — assign process type (sets initial state)
  fastify.patch(
    "/:id/process-type",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as JwtPayload;
      const { process_type_id } = z
        .object({ process_type_id: z.string().uuid() })
        .parse(request.body);

      const doc = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
      if (!doc) return reply.code(404).send({ error: "Document not found" });

      try {
        const result = await assignProcessType(fastify.db, id, process_type_id);
        await logAudit(fastify.db, {
          document_id: id,
          user_id: user.sub,
          action: "document.process_type.assign",
          ip: request.ip,
          metadata: { process_type_id },
        });
        return reply.send(result);
      } catch (err: any) {
        if (err.message === "NO_INITIAL_STATE") {
          return reply.code(422).send({ error: "Process type has no initial state defined" });
        }
        throw err;
      }
    }
  );

  // PATCH /documents/:id/transition — move to new state
  fastify.patch(
    "/:id/transition",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as JwtPayload;
      const { to_state_id, comment } = z
        .object({
          to_state_id: z.string().uuid(),
          comment: z.string().optional(),
        })
        .parse(request.body);

      const doc = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
      if (!doc) return reply.code(404).send({ error: "Document not found" });

      try {
        await transitionDocumentState(fastify.db, id, to_state_id, user.sub, user.role, comment);
        await logAudit(fastify.db, {
          document_id: id,
          user_id: user.sub,
          action: "document.state.transition",
          ip: request.ip,
          metadata: { to_state_id, comment },
        });
        return reply.send({ ok: true });
      } catch (err: any) {
        if (err.message === "TRANSITION_NOT_ALLOWED") return reply.code(422).send({ error: "Transition not allowed" });
        if (err.message === "ROLE_INSUFFICIENT") return reply.code(403).send({ error: "Your role cannot perform this transition" });
        if (err.message === "NO_PROCESS_TYPE") return reply.code(422).send({ error: "Document has no process type assigned" });
        throw err;
      }
    }
  );

  // GET /documents/:id/history — state history
  fastify.get("/:id/history", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;

    const doc = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
    if (!doc) return reply.code(404).send({ error: "Document not found" });

    const history = await getProcessHistory(fastify.db, id);
    return reply.send({ history });
  });

  // GET /documents/:id/schema-validation
  fastify.get("/:id/schema-validation", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;

    const doc = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
    if (!doc) return reply.code(404).send({ error: "Document not found" });

    const result = await validateDocumentSchema(fastify.db, id);
    return reply.send(result);
  });

  // POST /documents/:id/groups — assign to group
  fastify.post(
    "/:id/groups",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as JwtPayload;
      const { group_id } = z.object({ group_id: z.string().uuid() }).parse(request.body);

      const doc = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
      if (!doc) return reply.code(404).send({ error: "Document not found" });

      await assignDocumentToGroup(fastify.db, id, group_id);
      await logAudit(fastify.db, {
        document_id: id,
        user_id: user.sub,
        action: "document.group.assign",
        ip: request.ip,
        metadata: { group_id },
      });
      return reply.code(201).send({ ok: true });
    }
  );

  // DELETE /documents/:id/groups/:groupId — remove from group
  fastify.delete(
    "/:id/groups/:groupId",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { id, groupId } = request.params as { id: string; groupId: string };
      const user = request.user as JwtPayload;

      const doc = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
      if (!doc) return reply.code(404).send({ error: "Document not found" });

      await removeDocumentFromGroup(fastify.db, id, groupId);
      await logAudit(fastify.db, {
        document_id: id,
        user_id: user.sub,
        action: "document.group.remove",
        ip: request.ip,
        metadata: { groupId },
      });
      return reply.code(204).send();
    }
  );

  // DELETE /documents/:id
  fastify.delete(
    "/:id",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as JwtPayload;

      const doc = await getDocumentById(fastify.db, id, { userId: user.sub, userRole: user.role });
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
