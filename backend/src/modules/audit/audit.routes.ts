import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { getAuditLogs } from "./audit.service";

export async function auditRoutes(fastify: FastifyInstance) {
  // GET /audit - list audit logs (admin only)
  fastify.get(
    "/",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const query = z.object({
        document_id: z.string().uuid().optional(),
        user_id: z.string().uuid().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }).parse(request.query);

      const result = await getAuditLogs(fastify.db, query);
      return reply.send(result);
    }
  );
}
