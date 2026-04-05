import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { JwtPayload } from "../../types";
import {
  listRoles,
  createRole,
  getRoleById,
  updateRole,
  deleteRole,
  getRoleDocuments,
  addDocumentToRole,
  removeDocumentFromRole,
  getRoleUserBindings,
  bindUserToRole,
  unbindUserFromRole,
  getRoleGroupBindings,
  bindGroupToRole,
  unbindGroupFromRole,
} from "./roles.service";

const permissionLevels = ["viewer", "editor"] as const;

export async function roleRoutes(fastify: FastifyInstance) {
  // GET /roles
  fastify.get("/", { preHandler: [requireAuth, requireRole("admin")] }, async (_req, reply) => {
    const roles = await listRoles(fastify.db);
    return reply.send({ roles });
  });

  // POST /roles
  fastify.post(
    "/",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const caller = request.user as JwtPayload;
      const body = z
        .object({
          name: z.string().min(1).max(200),
          description: z.string().optional(),
          permission_level: z.enum(permissionLevels),
        })
        .parse(request.body);
      const role = await createRole(fastify.db, { ...body, created_by: caller.sub });
      return reply.code(201).send({ role });
    }
  );

  // GET /roles/:id
  fastify.get("/:id", { preHandler: [requireAuth, requireRole("admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const role = await getRoleById(fastify.db, id);
    if (!role) return reply.code(404).send({ error: "Role not found" });
    const [documents, userBindings, groupBindings] = await Promise.all([
      getRoleDocuments(fastify.db, id),
      getRoleUserBindings(fastify.db, id),
      getRoleGroupBindings(fastify.db, id),
    ]);
    return reply.send({ role, documents, userBindings, groupBindings });
  });

  // PATCH /roles/:id
  fastify.patch(
    "/:id",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          name: z.string().min(1).max(200).optional(),
          description: z.string().optional(),
          permission_level: z.enum(permissionLevels).optional(),
        })
        .parse(request.body);
      const role = await updateRole(fastify.db, id, body);
      if (!role) return reply.code(404).send({ error: "Role not found" });
      return reply.send({ role });
    }
  );

  // DELETE /roles/:id
  fastify.delete(
    "/:id",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const role = await getRoleById(fastify.db, id);
      if (!role) return reply.code(404).send({ error: "Role not found" });
      await deleteRole(fastify.db, id);
      return reply.code(204).send();
    }
  );

  // ── Documents ──────────────────────────────────────────────────────────────

  // POST /roles/:id/documents
  fastify.post(
    "/:id/documents",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { document_id } = z.object({ document_id: z.string().uuid() }).parse(request.body);
      const role = await getRoleById(fastify.db, id);
      if (!role) return reply.code(404).send({ error: "Role not found" });
      await addDocumentToRole(fastify.db, id, document_id);
      return reply.code(201).send({ ok: true });
    }
  );

  // DELETE /roles/:id/documents/:documentId
  fastify.delete(
    "/:id/documents/:documentId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id, documentId } = request.params as { id: string; documentId: string };
      await removeDocumentFromRole(fastify.db, id, documentId);
      return reply.code(204).send();
    }
  );

  // ── User bindings ──────────────────────────────────────────────────────────

  // POST /roles/:id/users
  fastify.post(
    "/:id/users",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const caller = request.user as JwtPayload;
      const { user_id } = z.object({ user_id: z.string().uuid() }).parse(request.body);
      const role = await getRoleById(fastify.db, id);
      if (!role) return reply.code(404).send({ error: "Role not found" });
      await bindUserToRole(fastify.db, id, user_id, caller.sub);
      return reply.code(201).send({ ok: true });
    }
  );

  // DELETE /roles/:id/users/:userId
  fastify.delete(
    "/:id/users/:userId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      await unbindUserFromRole(fastify.db, id, userId);
      return reply.code(204).send();
    }
  );

  // ── Group bindings ─────────────────────────────────────────────────────────

  // POST /roles/:id/groups
  fastify.post(
    "/:id/groups",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const caller = request.user as JwtPayload;
      const { group_id } = z.object({ group_id: z.string().uuid() }).parse(request.body);
      const role = await getRoleById(fastify.db, id);
      if (!role) return reply.code(404).send({ error: "Role not found" });
      await bindGroupToRole(fastify.db, id, group_id, caller.sub);
      return reply.code(201).send({ ok: true });
    }
  );

  // DELETE /roles/:id/groups/:groupId
  fastify.delete(
    "/:id/groups/:groupId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id, groupId } = request.params as { id: string; groupId: string };
      await unbindGroupFromRole(fastify.db, id, groupId);
      return reply.code(204).send();
    }
  );
}
