import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { JwtPayload } from "../../types";
import {
  listDeadlines,
  createDeadline,
  updateDeadline,
  deleteDeadline,
} from "./deadlines.service";

export async function deadlineRoutes(fastify: FastifyInstance) {
  // GET /documents/:id/deadlines
  fastify.get("/:id/deadlines", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deadlines = await listDeadlines(fastify.db, id);
    return reply.send({ deadlines });
  });

  // POST /documents/:id/deadlines
  fastify.post(
    "/:id/deadlines",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as JwtPayload;
      const body = z
        .object({
          label: z.string().min(1).max(200),
          due_at: z.string().datetime(),
          target_state_id: z.string().uuid().optional(),
          alert_days_before: z.array(z.number().int().min(0)).optional(),
        })
        .parse(request.body);

      const deadline = await createDeadline(fastify.db, {
        document_id: id,
        label: body.label,
        due_at: new Date(body.due_at),
        target_state_id: body.target_state_id,
        alert_days_before: body.alert_days_before,
        created_by: user.sub,
      });
      return reply.code(201).send({ deadline });
    }
  );

  // PATCH /documents/:id/deadlines/:deadlineId
  fastify.patch(
    "/:id/deadlines/:deadlineId",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { deadlineId } = request.params as { id: string; deadlineId: string };
      const body = z
        .object({
          label: z.string().min(1).max(200).optional(),
          due_at: z.string().datetime().optional(),
          alert_days_before: z.array(z.number().int().min(0)).optional(),
        })
        .parse(request.body);

      try {
        const deadline = await updateDeadline(fastify.db, deadlineId, {
          label: body.label,
          due_at: body.due_at ? new Date(body.due_at) : undefined,
          alert_days_before: body.alert_days_before,
        });
        return reply.send({ deadline });
      } catch (err: any) {
        if (err.message === "NOT_FOUND") return reply.code(404).send({ error: "Deadline not found" });
        throw err;
      }
    }
  );

  // DELETE /documents/:id/deadlines/:deadlineId
  fastify.delete(
    "/:id/deadlines/:deadlineId",
    { preHandler: [requireAuth, requireRole("admin", "editor")] },
    async (request, reply) => {
      const { deadlineId } = request.params as { id: string; deadlineId: string };
      await deleteDeadline(fastify.db, deadlineId);
      return reply.code(204).send();
    }
  );
}
