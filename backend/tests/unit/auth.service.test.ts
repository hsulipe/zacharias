import crypto from "crypto";

// Test the password hashing logic in isolation
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(hash, "hex"));
}

describe("Auth service — password hashing", () => {
  it("hashes a password and verifies it correctly", () => {
    const salt = generateSalt();
    const hash = hashPassword("mySecureP@ssw0rd", salt);
    expect(verifyPassword("mySecureP@ssw0rd", hash, salt)).toBe(true);
  });

  it("rejects wrong password", () => {
    const salt = generateSalt();
    const hash = hashPassword("correctPassword", salt);
    expect(verifyPassword("wrongPassword", hash, salt)).toBe(false);
  });

  it("produces different hashes for different salts", () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const hash1 = hashPassword("samePassword", salt1);
    const hash2 = hashPassword("samePassword", salt2);
    expect(hash1).not.toBe(hash2);
  });

  it("salt is 64 hex chars (32 bytes)", () => {
    const salt = generateSalt();
    expect(salt).toHaveLength(64);
  });
});
