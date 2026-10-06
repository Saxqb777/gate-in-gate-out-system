"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/app/form";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { DemoAccount } from "./demo-accounts";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "customer", label: "Customer" },
  { value: "carrier", label: "Carrier" },
  { value: "security", label: "Security" },
];

export function LoginForm({ next, demoAccounts }: { next?: string; demoAccounts?: DemoAccount[] }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const [role, setRole] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [autoSubmit, setAutoSubmit] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (autoSubmit) {
      setAutoSubmit(false);
      formRef.current?.requestSubmit();
    }
  }, [autoSubmit]);
  function pickDemo(a: DemoAccount) {
    setRole(a.role);
    setEmail(a.email);
    setPassword(a.password);
    setAutoSubmit(true);
  }
  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="role" value={role} />
      <div className="grid gap-1.5">
        <span className="text-xs font-medium">Role</span>
        <div className="grid grid-cols-4 rounded-md border bg-muted p-0.5" role="radiogroup" aria-label="Role">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={role === r.value}
              onClick={() => setRole(r.value)}
              className={cn("rounded-[5px] px-2 py-1.5 text-sm transition-colors", role === r.value ? "bg-card font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required placeholder="name@company.ae" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <FormError message={state?.error} />
      <Button type="submit" size="lg" disabled={pending} className="mt-1">
        {pending ? "Signing in..." : "Sign in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Access is managed by the Agthia warehouse admin.</p>
      {demoAccounts && demoAccounts.length > 0 && (
        <div className="mt-2 rounded-md border bg-card">
          <div className="border-b px-3 py-2">
            <div className="text-xs font-semibold">Demo accounts</div>
            <div className="text-[11px] text-muted-foreground">Click one to sign in. Turn this list off under Admin, Configuration.</div>
          </div>
          <ul className="divide-y">
            {demoAccounts.map((a) => (
              <li key={a.email}>
                <button type="button" disabled={pending} onClick={() => pickDemo(a)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted disabled:opacity-60">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{a.detail}, {a.email}</span>
                  </span>
                  <span className="shrink-0 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">{ROLE_LABEL[a.role]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
