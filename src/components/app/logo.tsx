import { cn } from "@/lib/utils";

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("flex size-8 items-center justify-center rounded-md", light ? "bg-primary" : "bg-primary")} aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17h13v-6H3z" />
          <path d="M16 13h3l2 3v1h-5z" />
          <circle cx="7" cy="19" r="1.5" />
          <circle cx="17" cy="19" r="1.5" />
          <path d="M8 8V5M12 8V4M16 8V6" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className={cn("text-sm font-semibold tracking-tight", light ? "text-white" : "text-foreground")}>FoahGate</div>
        <div className={cn("text-[11px]", light ? "text-sidebar-muted" : "text-muted-foreground")}>Agthia, Al Foah</div>
      </div>
    </div>
  );
}
