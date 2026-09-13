"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/app/form";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "customer", label: "Customer" },
  { value: "carrier", label: "Carrier" },
  { value: "security", label: "Security" },
];

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const [role, setRole] = useState("admin");
  return (
    <form action={action} className="grid gap-4">
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
        <Input id="email" name="email" type="email" autoComplete="username" required placeholder="name@company.ae" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormError message={state?.error} />
      <Button type="submit" size="lg" disabled={pending} className="mt-1">
        {pending ? "Signing in..." : "Sign in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Access is managed by the Agthia warehouse admin.</p>
    </form>
  );
}
