import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { JwtPayload } from "../../types";
import {
  listGroups,
  createGroup,
  getGroupById,
  deleteGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
} from "./groups.service";

export async function groupRoutes(fastify: FastifyInstance) {
  // GET /groups
  fastify.get("/", { preHandler: [requireAuth] }, async (_request, reply) => {
    const groups = await listGroups(fastify.db);
    return reply.send({ groups });
  });

  // POST /groups — admin only
  fastify.post(
    "/",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const body = z
        .object({
          name: z.string().min(1).max(200),
          description: z.string().optional(),
        })
        .parse(request.body);

      const group = await createGroup(fastify.db, {
        name: body.name,
        description: body.description,
        created_by: user.sub,
      });
      return reply.code(201).send({ group });
    }
  );

  // GET /groups/:id — with members
  fastify.get("/:id", { preHandler: [requireAuth, requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const group = await getGroupById(fastify.db, id);
    if (!group) return reply.code(404).send({ error: "Group not found" });
    const members = await getGroupMembers(fastify.db, id);
    return reply.send({ group, members });
  });

  // DELETE /groups/:id — admin only
  fastify.delete(
    "/:id",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const group = await getGroupById(fastify.db, id);
      if (!group) return reply.code(404).send({ error: "Group not found" });
      await deleteGroup(fastify.db, id);
      return reply.code(204).send();
    }
  );

  // POST /groups/:id/members — admin only
  fastify.post(
    "/:id/members",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const caller = request.user as JwtPayload;
      const { user_id } = z.object({ user_id: z.string().uuid() }).parse(request.body);

      const group = await getGroupById(fastify.db, id);
      if (!group) return reply.code(404).send({ error: "Group not found" });

      await addGroupMember(fastify.db, id, user_id, caller.sub);
      return reply.code(201).send({ ok: true });
    }
  );

  // DELETE /groups/:id/members/:userId — admin only
  fastify.delete(
    "/:id/members/:userId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const group = await getGroupById(fastify.db, id);
      if (!group) return reply.code(404).send({ error: "Group not found" });
      await removeGroupMember(fastify.db, id, userId);
      return reply.code(204).send();
    }
  );
}
