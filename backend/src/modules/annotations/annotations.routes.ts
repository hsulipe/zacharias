import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { JwtPayload } from "../../types";
import {
  listAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from "./annotations.service";

const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export async function annotationRoutes(fastify: FastifyInstance) {
  // GET /documents/:id/annotations
  fastify.get("/:id/annotations", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const annotations = await listAnnotations(fastify.db, id);
    return reply.send({ annotations });
  });

  // POST /documents/:id/annotations
  fastify.post("/:id/annotations", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;
    const body = z
      .object({
        page: z.number().int().min(1),
        type: z.enum(["highlight", "comment"]),
        rect: rectSchema,
        selected_text: z.string().optional(),
        content: z.string().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      })
      .parse(request.body);

    const annotation = await createAnnotation(fastify.db, {
      document_id: id,
      user_id: user.sub,
      ...body,
    });
    return reply.code(201).send({ annotation });
  });

  // PATCH /documents/:id/annotations/:annotId
  fastify.patch(
    "/:id/annotations/:annotId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { annotId } = request.params as { id: string; annotId: string };
      const body = z
        .object({
          content: z.string().optional(),
          color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        })
        .parse(request.body);

      try {
        const annotation = await updateAnnotation(fastify.db, annotId, body);
        return reply.send({ annotation });
      } catch (err: any) {
        if (err.message === "NOT_FOUND") return reply.code(404).send({ error: "Annotation not found" });
        throw err;
      }
    }
  );

  // DELETE /documents/:id/annotations/:annotId
  fastify.delete(
    "/:id/annotations/:annotId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { annotId } = request.params as { id: string; annotId: string };
      const user = request.user as JwtPayload;

      try {
        await deleteAnnotation(fastify.db, annotId, user.sub, user.role);
        return reply.code(204).send();
      } catch (err: any) {
        if (err.message === "NOT_FOUND") return reply.code(404).send({ error: "Annotation not found" });
        if (err.message === "FORBIDDEN") return reply.code(403).send({ error: "Forbidden" });
        throw err;
      }
    }
  );
}
