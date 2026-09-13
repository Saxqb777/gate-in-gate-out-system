import { redirect } from "next/navigation";
import { getSession, ROLE_HOME, type SessionUser } from "./session";
import type { UserRole } from "@/lib/db/schema";

/** Server side guard for pages and actions. Redirects to login if no session, or to the user's home if the role does not match. */
export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (roles.length && !roles.includes(session.role)) {
    redirect(ROLE_HOME[session.role]);
  }
  return session;
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

/** For server actions: throws instead of redirecting so the client can show an inline error. */
export async function actionSession(...roles: UserRole[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new ActionError("Your session has expired. Please sign in again.");
  if (roles.length && !roles.includes(session.role)) {
    throw new ActionError("You do not have permission to perform this action.");
  }
  return session;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

export async function runAction<T>(fn: () => Promise<{ data?: T; message?: string } | void>): Promise<ActionResult<T>> {
  try {
    const r = await fn();
    return { ok: true, data: r?.data, message: r?.message };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, error: err.message };
    const e = err as { code?: string; message?: string; constraint?: string };
    if (e?.code === "23P01" || e?.constraint === "bookings_no_dock_overlap") {
      return { ok: false, error: "That slot was taken a moment ago by another booking. Please pick another slot." };
    }
    console.error("Action failed", err);
    return { ok: false, error: e?.message ? `Something went wrong: ${e.message}` : "Something went wrong. Please try again." };
  }
}
