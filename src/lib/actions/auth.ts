"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, organisations, type UserRole } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, setSessionCookie, clearSessionCookie, ROLE_HOME, ROLE_LABEL } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  const next = String(formData.get("next") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };
  if (!["admin", "carrier", "customer", "security"].includes(role)) return { error: "Choose the role you are signing in as." };

  const [row] = await db
    .select({ user: users, org: organisations })
    .from(users)
    .innerJoin(organisations, eq(organisations.id, users.organisationId))
    .where(sql`lower(${users.email}) = ${email}`);

  if (!row || !(await verifyPassword(password, row.user.passwordHash))) {
    return { error: "Email or password is incorrect." };
  }
  if (!row.user.active) return { error: "This account is disabled. Contact the warehouse admin." };
  if (row.user.role !== role) {
    return { error: `This account is registered as ${ROLE_LABEL[row.user.role]}, not ${ROLE_LABEL[role]}. Select the correct role and try again.` };
  }

  const token = await signSession({
    id: row.user.id,
    name: row.user.name,
    email: row.user.email,
    role: row.user.role,
    organisationId: row.org.id,
    organisationName: row.org.name,
    organisationType: row.org.type,
    title: row.user.title,
    warehouseOpsView: row.user.warehouseOpsView,
  });
  await setSessionCookie(token);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.user.id));
  await writeAudit(db, { entityType: "user", entityId: row.user.id, action: "LOGIN", actorUserId: row.user.id });

  const home = row.user.role === "admin" && row.user.warehouseOpsView ? "/admin/dock-board" : ROLE_HOME[row.user.role];
  const safeNext = next.startsWith("/") && !next.startsWith("//") && (next.startsWith(`/${row.user.role}`) || next.startsWith("/book/")) ? next : null;
  redirect(safeNext ?? home);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
