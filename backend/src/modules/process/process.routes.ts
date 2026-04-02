import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth";
import { JwtPayload } from "../../types";
import {
  listProcessTypes,
  createProcessType,
  getProcessTypeById,
  updateProcessType,
  deleteProcessType,
  listProcessStates,
  createProcessState,
  updateProcessState,
  deleteProcessState,
  listProcessTransitions,
  createProcessTransition,
  deleteProcessTransition,
  getSchema,
  upsertSchema,
  deleteSchema,
} from "./process.service";

const schemaFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "date", "number", "select"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  hint: z.string().optional(),
});

export async function processTypeRoutes(fastify: FastifyInstance) {
  // GET /process-types
  fastify.get("/", { preHandler: [requireAuth] }, async (_req, reply) => {
    const types = await listProcessTypes(fastify.db);
    return reply.send({ process_types: types });
  });

  // POST /process-types
  fastify.post(
    "/",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const body = z
        .object({ name: z.string().min(1).max(200), description: z.string().optional() })
        .parse(request.body);
      const pt = await createProcessType(fastify.db, { ...body, created_by: user.sub });
      return reply.code(201).send({ process_type: pt });
    }
  );

  // GET /process-types/:typeId — with states and transitions
  fastify.get("/:typeId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { typeId } = request.params as { typeId: string };
    const pt = await getProcessTypeById(fastify.db, typeId);
    if (!pt) return reply.code(404).send({ error: "Process type not found" });
    const states = await listProcessStates(fastify.db, typeId);
    const transitions = await listProcessTransitions(fastify.db, typeId);
    return reply.send({ process_type: pt, states, transitions });
  });

  // PUT /process-types/:typeId
  fastify.put(
    "/:typeId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { typeId } = request.params as { typeId: string };
      const body = z
        .object({ name: z.string().min(1).max(200).optional(), description: z.string().optional() })
        .parse(request.body);
      try {
        const pt = await updateProcessType(fastify.db, typeId, body);
        return reply.send({ process_type: pt });
      } catch (err: any) {
        if (err.message === "NOT_FOUND") return reply.code(404).send({ error: "Process type not found" });
        if (err.message === "NO_FIELDS") return reply.code(400).send({ error: "No fields to update" });
        throw err;
      }
    }
  );

  // DELETE /process-types/:typeId
  fastify.delete(
    "/:typeId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { typeId } = request.params as { typeId: string };
      await deleteProcessType(fastify.db, typeId);
      return reply.code(204).send();
    }
  );

  // POST /process-types/:typeId/states
  fastify.post(
    "/:typeId/states",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { typeId } = request.params as { typeId: string };
      const body = z
        .object({
          name: z.string().min(1).max(100),
          label: z.string().min(1).max(200),
          is_initial: z.boolean().optional(),
          is_terminal: z.boolean().optional(),
          color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
          position_order: z.number().int().optional(),
        })
        .parse(request.body);
      const state = await createProcessState(fastify.db, { process_type_id: typeId, ...body });
      return reply.code(201).send({ state });
    }
  );

  // PUT /process-types/:typeId/states/:stateId
  fastify.put(
    "/:typeId/states/:stateId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { stateId } = request.params as { typeId: string; stateId: string };
      const body = z
        .object({
          name: z.string().min(1).max(100).optional(),
          label: z.string().min(1).max(200).optional(),
          is_initial: z.boolean().optional(),
          is_terminal: z.boolean().optional(),
          color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
          position_order: z.number().int().optional(),
        })
        .parse(request.body);
      try {
        const state = await updateProcessState(fastify.db, stateId, body);
        return reply.send({ state });
      } catch (err: any) {
        if (err.message === "NO_FIELDS") return reply.code(400).send({ error: "No fields to update" });
        return reply.code(404).send({ error: "State not found" });
      }
    }
  );

  // DELETE /process-types/:typeId/states/:stateId
  fastify.delete(
    "/:typeId/states/:stateId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { stateId } = request.params as { typeId: string; stateId: string };
      await deleteProcessState(fastify.db, stateId);
      return reply.code(204).send();
    }
  );

  // POST /process-types/:typeId/transitions
  fastify.post(
    "/:typeId/transitions",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { typeId } = request.params as { typeId: string };
      const body = z
        .object({
          from_state_id: z.string().uuid(),
          to_state_id: z.string().uuid(),
          label: z.string().min(1).max(200),
          required_role: z.enum(["admin", "editor", "viewer"]).optional(),
        })
        .parse(request.body);
      const transition = await createProcessTransition(fastify.db, {
        process_type_id: typeId,
        ...body,
      });
      return reply.code(201).send({ transition });
    }
  );

  // DELETE /process-types/:typeId/transitions/:transId
  fastify.delete(
    "/:typeId/transitions/:transId",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { transId } = request.params as { typeId: string; transId: string };
      await deleteProcessTransition(fastify.db, transId);
      return reply.code(204).send();
    }
  );

  // GET /process-types/:typeId/schema
  fastify.get("/:typeId/schema", { preHandler: [requireAuth] }, async (request, reply) => {
    const { typeId } = request.params as { typeId: string };
    const schema = await getSchema(fastify.db, typeId);
    return reply.send({ schema });
  });

  // PUT /process-types/:typeId/schema
  fastify.put(
    "/:typeId/schema",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { typeId } = request.params as { typeId: string };
      const { fields } = z.object({ fields: z.array(schemaFieldSchema) }).parse(request.body);
      const schema = await upsertSchema(fastify.db, typeId, fields);
      return reply.send({ schema });
    }
  );

  // DELETE /process-types/:typeId/schema
  fastify.delete(
    "/:typeId/schema",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { typeId } = request.params as { typeId: string };
      await deleteSchema(fastify.db, typeId);
      return reply.code(204).send();
    }
  );
}
