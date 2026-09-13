import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({ label, htmlFor, required, hint, error, children, className }: { label: string; htmlFor?: string; required?: boolean; hint?: string; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-status-exception">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-status-exception">{error}</p>}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="rounded border border-status-exception/30 bg-status-exception-bg px-3 py-2 text-sm text-status-exception">{message}</div>;
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-b pb-5 last:border-b-0 last:pb-0">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}
