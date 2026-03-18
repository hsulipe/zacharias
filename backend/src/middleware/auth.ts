import { FastifyRequest, FastifyReply } from "fastify";
import { JwtPayload, UserRole } from "../types";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
    const payload = request.user as JwtPayload;
    if (payload.type !== "access") {
      return reply.code(401).send({ error: "Invalid token type" });
    }
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const payload = request.user as JwtPayload;
    if (!roles.includes(payload.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}
