"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/auth/guard";

/**
 * Runs a server action from a button: toast on success, inline error text on failure,
 * then refreshes the route so server rendered boards pick up the change.
 */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    (fn: () => Promise<ActionResult<unknown>>, onSuccess?: () => void) => {
      setError(null);
      start(async () => {
        const res = await fn();
        if (!res.ok) {
          setError(res.error);
          return;
        }
        toast.success(res.message ?? "Done.");
        router.refresh();
        onSuccess?.();
      });
    },
    [router],
  );
  return { run, pending, error, setError };
}
