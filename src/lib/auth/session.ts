import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE, SESSION_HOURS, verifySessionToken } from "./jwt";
import type { SessionUser } from "./roles";

export { signSession, verifySessionToken, SESSION_COOKIE } from "./jwt";
export { ROLE_HOME, ROLE_LABEL, type SessionUser } from "./roles";

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
});
