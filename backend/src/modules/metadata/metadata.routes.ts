import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { JwtPayload } from "../../types";
import { setMetadata, getMetadata, deleteMetadataKey } from "./metadata.service";
import { getDocumentById } from "../documents/documents.service";
import { logAudit } from "../audit/audit.service";

export async function metadataRoutes(fastify: FastifyInstance) {
  // GET /documents/:id/metadata
  fastify.get(
    "/:id/metadata",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const doc = await getDocumentById(fastify.db, id);
      if (!doc) return reply.code(404).send({ error: "Document not found" });

      const metadata = await getMetadata(fastify.db, id);
      return reply.send({ metadata });
    }
  );

  // PUT /documents/:id/metadata
  fastify.put(
    "/:id/metadata",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as JwtPayload;
      const { entries } = z.object({
        entries: z.array(z.object({ key: z.string().min(1).max(100), value: z.string().max(1000) })),
      }).parse(request.body);

      const doc = await getDocumentById(fastify.db, id);
      if (!doc) return reply.code(404).send({ error: "Document not found" });

      const metadata = await setMetadata(fastify.db, id, entries);
      await logAudit(fastify.db, {
        document_id: id,
        user_id: user.sub,
        action: "document.metadata.update",
        ip: request.ip,
        metadata: { keys: entries.map((e) => e.key) },
      });

      return reply.send({ metadata });
    }
  );

  // DELETE /documents/:id/metadata/:key
  fastify.delete(
    "/:id/metadata/:key",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { id, key } = request.params as { id: string; key: string };
      const doc = await getDocumentById(fastify.db, id);
      if (!doc) return reply.code(404).send({ error: "Document not found" });

      await deleteMetadataKey(fastify.db, id, key);
      return reply.code(204).send();
    }
  );
}
