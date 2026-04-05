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
import { getGroupRoles, bindGroupToRole, unbindGroupFromRole, getRoleById } from "../roles/roles.service";

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

  // GET /groups/:id/roles — list roles assigned to this group
  fastify.get(
    "/:id/roles",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const group = await getGroupById(fastify.db, id);
      if (!group) return reply.code(404).send({ error: "Group not found" });
      const roles = await getGroupRoles(fastify.db, id);
      return reply.send({ roles });
    }
  );

  // POST /groups/:id/roles — assign a role to this group
  fastify.post(
    "/:id/roles",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const caller = request.user as JwtPayload;
      const { role_id } = z.object({ role_id: z.string().uuid() }).parse(request.body);
      const group = await getGroupById(fastify.db, id);
      if (!group) return reply.code(404).send({ error: "Group not found" });
      const role = await getRoleById(fastify.db, role_id);
      if (!role) return reply.code(404).send({ error: "Role not found" });
      await bindGroupToRole(fastify.db, role_id, id, caller.sub);
      return reply.code(201).send({ ok: true });
    }
  );

  // DELETE /groups/:id/roles/:roleId — remove a role from this group
  fastify.delete(
    "/:id/roles/:roleId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id, roleId } = request.params as { id: string; roleId: string };
      await unbindGroupFromRole(fastify.db, roleId, id);
      return reply.code(204).send();
    }
  );
}
