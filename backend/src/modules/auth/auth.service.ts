import { Pool } from "pg";
import crypto from "crypto";
import { User, JwtPayload, UserRole } from "../../types";
import { RegisterInput, LoginInput } from "./auth.schema";

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(hash, "hex"));
}

export async function registerUser(
  db: Pool,
  input: RegisterInput
): Promise<User> {
  // Check existing email
  const existing = await db.query("SELECT id FROM users WHERE email = $1", [input.email]);
  if (existing.rows.length > 0) {
    throw new Error("EMAIL_TAKEN");
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(input.password, salt);

  const result = await db.query<User>(
    `INSERT INTO users (name, email, password_hash, password_salt, role)
     VALUES ($1, $2, $3, $4, 'viewer')
     RETURNING id, name, email, role, plan_id, created_at, updated_at`,
    [input.name, input.email, passwordHash, salt]
  );

  return result.rows[0];
}

export async function loginUser(
  db: Pool,
  input: LoginInput
): Promise<User> {
  const result = await db.query<User & { password_hash: string; password_salt: string }>(
    "SELECT id, name, email, role, plan_id, created_at, updated_at, password_hash, password_salt FROM users WHERE email = $1",
    [input.email]
  );

  if (result.rows.length === 0) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const user = result.rows[0];
  if (!verifyPassword(input.password, user.password_hash, user.password_salt)) {
    throw new Error("INVALID_CREDENTIALS");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan_id: user.plan_id,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function getUserById(db: Pool, id: string): Promise<User | null> {
  const result = await db.query<User>(
    "SELECT id, name, email, role, plan_id, created_at, updated_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function listUsers(db: Pool): Promise<User[]> {
  const result = await db.query<User>(
    "SELECT id, name, email, role, plan_id, created_at, updated_at FROM users ORDER BY created_at DESC"
  );
  return result.rows;
}

export async function updateUserRole(db: Pool, id: string, role: UserRole): Promise<User> {
  const result = await db.query<User>(
    `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, name, email, role, plan_id, created_at, updated_at`,
    [role, id]
  );
  if (result.rows.length === 0) throw new Error("USER_NOT_FOUND");
  return result.rows[0];
}
