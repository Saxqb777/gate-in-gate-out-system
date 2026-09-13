import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "./roles";

export const SESSION_COOKIE = "foahgate_session";
export const SESSION_HOURS = 12;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET must be set and at least 16 characters long");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.user as SessionUser) ?? null;
  } catch {
    return null;
  }
}
