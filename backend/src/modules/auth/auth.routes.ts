import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  RegisterInput,
  LoginInput,
  RefreshInput,
} from "./auth.schema";
import { registerUser, loginUser, getUserById, listUsers, updateUserRole } from "./auth.service";
import { logAudit } from "../audit/audit.service";
import { requireAuth, requireRole } from "../../middleware/auth";
import { JwtPayload } from "../../types";

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/register
  fastify.post("/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    try {
      const user = await registerUser(fastify.db, body);
      await logAudit(fastify.db, {
        user_id: user.id,
        action: "user.register",
        ip: request.ip,
      });
      return reply.code(201).send({ user });
    } catch (err: any) {
      if (err.message === "EMAIL_TAKEN") {
        return reply.code(409).send({ error: "Email already in use" });
      }
      throw err;
    }
  });

  // POST /auth/login
  fastify.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    try {
      const user = await loginUser(fastify.db, body);
      const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, type: "access" };
      const accessToken = fastify.jwt.sign(payload, { expiresIn: "15m" });
      const refreshPayload: JwtPayload = { ...payload, type: "refresh" };
      const refreshToken = fastify.jwt.sign(refreshPayload, { expiresIn: "7d" });
      await logAudit(fastify.db, {
        user_id: user.id,
        action: "user.login",
        ip: request.ip,
      });
      return reply.send({ access_token: accessToken, refresh_token: refreshToken, user });
    } catch (err: any) {
      if (err.message === "INVALID_CREDENTIALS") {
        return reply.code(401).send({ error: "Invalid email or password" });
      }
      throw err;
    }
  });

  // POST /auth/refresh
  fastify.post("/refresh", async (request, reply) => {
    const { refresh_token } = refreshSchema.parse(request.body);
    try {
      const decoded = fastify.jwt.verify<JwtPayload>(refresh_token);
      if (decoded.type !== "refresh") {
        return reply.code(401).send({ error: "Invalid token type" });
      }
      const user = await getUserById(fastify.db, decoded.sub);
      if (!user) return reply.code(401).send({ error: "User not found" });
      const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, type: "access" };
      const accessToken = fastify.jwt.sign(payload, { expiresIn: "15m" });
      return reply.send({ access_token: accessToken });
    } catch {
      return reply.code(401).send({ error: "Invalid or expired refresh token" });
    }
  });

  // GET /auth/me
  fastify.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const user = await getUserById(fastify.db, payload.sub);
    if (!user) return reply.code(404).send({ error: "User not found" });
    return reply.send({ user });
  });

  // GET /auth/users (admin only)
  fastify.get("/users", { preHandler: [requireAuth, requireRole("admin")] }, async (_request, reply) => {
    const users = await listUsers(fastify.db);
    return reply.send({ users });
  });

  // PATCH /auth/users/:id/role (admin only)
  fastify.patch(
    "/users/:id/role",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { role } = z.object({ role: z.enum(["admin", "editor", "viewer"]) }).parse(request.body);
      try {
        const user = await updateUserRole(fastify.db, id, role);
        return reply.send({ user });
      } catch (err: any) {
        if (err.message === "USER_NOT_FOUND") return reply.code(404).send({ error: "User not found" });
        throw err;
      }
    }
  );
}
