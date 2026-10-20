import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// No accounts: a company is reached by its unguessable URL plus an access code
// the owner chose. The code is stored only as a salted scrypt hash.

export function hashCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(code, salt, 32).toString("hex")}`;
}

export function verifyCode(code: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(code, salt, 32);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const cookieName = (companyId: string) => `sc_${companyId}`;

// Ties the cookie to the current code hash, so changing the code logs every device out.
function token(companyId: string, accessHash: string): string {
  const secret = process.env.ACCESS_SECRET ?? "dev-only-secret";
  return createHmac("sha256", secret).update(`${companyId}:${accessHash}`).digest("hex");
}

export async function grantAccess(companyId: string, accessHash: string, remember: boolean) {
  (await cookies()).set(cookieName(companyId), token(companyId, accessHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 365 } : {}), // otherwise a session cookie
  });
}

export async function hasAccess(companyId: string, accessHash: string): Promise<boolean> {
  const value = (await cookies()).get(cookieName(companyId))?.value;
  if (!value) return false;
  const expected = token(companyId, accessHash);
  return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export async function revokeAccess(companyId: string) {
  (await cookies()).delete(cookieName(companyId));
}
