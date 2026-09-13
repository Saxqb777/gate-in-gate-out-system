"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/app/form";
import { BookingStatusBadge, TonePill } from "@/components/app/status-badge";
import { lookupBookingAction, gateInAction, sendToYardAction, callToDockAction, gateOutAction, flagExceptionAction, type LookupResult, type GateInResult } from "@/lib/actions/gate";
import { fmtDate, fmtTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ActionDialog, type ActionDialogConfig } from "./action-dialog";
import type { Html5Qrcode } from "html5-qrcode";

const INSIDE = ["ARRIVED", "IN_YARD", "AT_DOCK", "HANDLING", "COMPLETED", "EXCEPTION"];
const CLOSED = ["GATE_OUT", "CANCELLED", "REJECTED", "NO_SHOW"];

type Recent = { at: string; lookup: string; reference: string; plate: string | null; verdict: "GRANTED" | "CHECK" };

export function GateScanner({ initialQuery }: { initialQuery: string | null }) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GateInResult | { outcome: "message"; text: string; tone: "done" | "waiting" } | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [dialog, setDialog] = useState<ActionDialogConfig | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const lookup = useCallback(async (value: string, silent = false) => {
    const v = value.trim();
    if (!v) return;
    setPending(true);
    setError(null);
    if (!silent) setOutcome(null);
    const res = await lookupBookingAction(v);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      if (!silent) setResult(null);
      return;
    }
    const d = res.data!;
    setResult(d);
    if (!silent) {
      setRecent((r) => [{ at: fmtTime(new Date()), lookup: v, reference: d.reference, plate: d.truckPlate, verdict: d.verdict }, ...r.filter((x) => x.reference !== d.reference)].slice(0, 5));
    }
  }, []);

  useEffect(() => {
    if (initialQuery) void lookup(initialQuery);
  }, [initialQuery, lookup]);

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  useEffect(() => () => void stopCamera(), [stopCamera]);

  async function startCamera() {
    setCameraError(null);
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await new Promise((r) => setTimeout(r, 50));
      const s = new Html5Qrcode("qr-reader", { verbose: false });
      scannerRef.current = s;
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          void stopCamera();
          setQuery(text);
          void lookup(text);
        },
        () => {},
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCameraError(/NotAllowed|Permission/i.test(msg) ? "Camera permission was refused. Type the reference instead." : /secure|https/i.test(msg) ? "The camera needs a secure connection (https). Type the reference instead." : "Camera not available on this device. Type the reference instead.");
      await stopCamera();
    }
  }

  function refresh() {
    if (result) void lookup(result.reference, true);
  }

  async function doGateIn() {
    if (!result) return;
    const needsNote = result.verdict === "CHECK";
    const tooEarly = result.reasons.some((r) => r.includes("before slot"));
    const run = async (note?: string) => {
      const res = await gateInAction(result.bookingId, note, tooEarly);
      if (!res.ok) {
        setError(res.error);
        return res;
      }
      setOutcome(res.data!);
      toast.success(res.message ?? "Gated in.");
      refresh();
      return res;
    };
    if (needsNote) {
      setDialog({ title: "Gate in with a note", description: "This pass needs a check. Record why the truck is being admitted.", confirmLabel: "Gate in", noteRequired: true, noteLabel: "Reason for admitting", run: async ({ note }) => run(note) });
    } else {
      await run();
    }
  }

  const b = result;
  const isBooked = b?.status === "BOOKED";
  const isInside = b ? INSIDE.includes(b.status) : false;
  const isClosed = b ? CLOSED.includes(b.status) : false;

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(query);
        }}
      >
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reference, gate pass or scan" className="h-12 flex-1 text-base" autoFocus inputMode="text" autoCapitalize="characters" />
          <Button type="submit" size="lg" className="h-12 px-4 text-base" disabled={pending}>
            <Search className="size-5" />
            Look up
          </Button>
        </div>
        <div className="flex gap-2">
          {!scanning ? (
            <Button type="button" variant="outline" size="lg" className="h-12 flex-1 text-base" onClick={startCamera}>
              <Camera className="size-5" />
              Scan QR with camera
            </Button>
          ) : (
            <Button type="button" variant="outline" size="lg" className="h-12 flex-1 text-base" onClick={stopCamera}>
              <X className="size-5" />
              Stop camera
            </Button>
          )}
        </div>
        {cameraError && <FormError message={cameraError} />}
        <div id="qr-reader" className={cn("overflow-hidden rounded-md border bg-black", scanning ? "block" : "hidden")} />
        <FormError message={error} />
      </form>

      {outcome && (
        <div
          className={cn(
            "rounded-md border px-4 py-3",
            outcome.outcome === "dock" || (outcome.outcome === "message" && outcome.tone === "done") ? "border-status-done/40 bg-status-done-bg text-status-done" : "border-status-waiting/40 bg-status-waiting-bg text-status-waiting",
          )}
        >
          {outcome.outcome === "dock" && (
            <>
              <div className="text-2xl font-semibold">Proceed to {outcome.dockCode}</div>
              <div className="text-base">{outcome.dockName}</div>
              {outcome.promoted && <div className="mt-1 text-sm">Early arrival: promoted into a free dock.</div>}
              {!outcome.promoted && outcome.redirected && <div className="mt-1 text-sm">Booked dock is busy: redirected to a free dock.</div>}
              {outcome.bumped.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {outcome.bumped.map((x) => (
                    <li key={x.reference}>
                      Moved {x.reference} from {x.from} to {x.to}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {outcome.outcome === "yard" && (
            <>
              <div className="text-2xl font-semibold">Wait in yard, position {outcome.position}</div>
              <div className="mt-1 text-sm">{outcome.reason}</div>
            </>
          )}
          {outcome.outcome === "message" && <div className="text-xl font-semibold">{outcome.text}</div>}
        </div>
      )}

      {!b && !pending && (
        <div className="rounded-md border border-dashed bg-card px-4 py-10 text-center text-base text-muted-foreground">Look up a pass to begin.</div>
      )}

      {b && (
        <div className="overflow-hidden rounded-md border bg-card">
          <div className={cn("px-4 py-4 text-white", b.verdict === "GRANTED" ? "bg-status-done" : "bg-status-exception")}>
            <div className="text-4xl font-bold tracking-tight">{b.verdict}</div>
            {b.verdict === "CHECK" && (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {b.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            {b.verdict === "GRANTED" && <div className="mt-1 text-sm opacity-90">Pass is valid. Confirm the plate and driver, then gate in.</div>}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <BookingStatusBadge status={b.status as never} />
            {b.slotStart && (
              <TonePill tone={b.arrival === "late" ? "exception" : b.arrival === "early" ? "waiting" : "done"}>
                {b.arrival === "early" ? "Early" : b.arrival === "late" ? "Late" : b.arrival === "on_time" ? "On time" : "No slot"}, slot {fmtTime(b.slotStart)} to {fmtTime(b.slotEnd)}
              </TonePill>
            )}
            {b.priority !== "normal" && b.priority !== "low" && <TonePill tone={b.priority === "urgent" ? "exception" : "waiting"}>{b.priority === "urgent" ? "Urgent" : "High priority"}</TonePill>}
          </div>
          <div className="grid gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-2">
            <Big label="Truck plate" value={b.truckPlate ?? "Not set"} mono large />
            <Big label="Trailer" value={b.trailerPlate ?? "None"} mono />
            <Big label="Driver" value={b.driverName ?? "Not set"} />
            <Big label="Driver mobile" value={b.driverMobile ?? "Not set"} mono />
            <Big label="Driver ID" value={b.driverIdNumber ?? "Not set"} mono />
            <Big label="Truck type" value={b.truckType ?? "Not set"} />
            <Big label="Carrier" value={b.carrier ?? "Not assigned"} />
            <Big label="Customer" value={b.customer ?? ""} />
            <Big label="Direction" value={b.direction === "inbound" ? "Inbound" : "Outbound"} />
            <Big label="Cargo" value={`${b.cargo}${b.cargoType ? `, ${b.cargoType}` : ""}${b.quantity ? `, ${b.quantity}` : ""}`} />
            {(b.containerNumber || b.sealNumber) && <Big label="Container and seal" value={`${b.containerNumber ?? ""} ${b.sealNumber ? `seal ${b.sealNumber}` : ""}`} mono />}
            <Big label="Booked slot" value={b.slotStart ? `${fmtDate(b.slotStart)}, ${fmtTime(b.slotStart)} to ${fmtTime(b.slotEnd)}` : "No slot"} />
            <Big label="Assigned dock" value={b.dockCode ? `${b.dockCode}, ${b.dockName}` : "Not assigned"} large />
            <Big label="Gate pass" value={b.gatePassNumber ?? "Not issued"} mono />
            <Big label="Reference" value={b.reference} mono />
          </div>
          <div className="grid gap-2 border-t bg-muted/40 px-4 py-3 sm:grid-cols-2">
            {isBooked && (
              <Button size="lg" className="h-12 text-base" onClick={doGateIn} disabled={pending}>
                Gate in
              </Button>
            )}
            {b.status === "IN_YARD" && (
              <Button
                size="lg"
                className="h-12 text-base"
                disabled={pending}
                onClick={async () => {
                  const res = await callToDockAction(b.bookingId, null);
                  if (!res.ok) return setError(res.error);
                  setOutcome({ outcome: "message", text: `Proceed to ${res.data!.dockCode}`, tone: "done" });
                  toast.success(res.message ?? "Called to dock.");
                  refresh();
                }}
              >
                Call to first free dock
              </Button>
            )}
            {["ARRIVED", "AT_DOCK", "EXCEPTION"].includes(b.status) && (
              <Button
                size="lg"
                variant="outline"
                className="h-12 text-base"
                onClick={() =>
                  setDialog({
                    title: "Send to yard",
                    confirmLabel: "Send to yard",
                    noteRequired: false,
                    noteLabel: "Note (optional)",
                    run: async ({ note }) => {
                      const res = await sendToYardAction(b.bookingId, note || undefined);
                      if (res.ok) {
                        setOutcome({ outcome: "message", text: res.message ?? "Sent to yard.", tone: "waiting" });
                        toast.success(res.message ?? "Sent to yard.");
                        refresh();
                      }
                      return res;
                    },
                  })
                }
              >
                Send to yard
              </Button>
            )}
            {isInside && (
              <Button
                size="lg"
                variant={b.status === "COMPLETED" ? "default" : "outline"}
                className="h-12 text-base"
                onClick={async () => {
                  if (b.status === "COMPLETED") {
                    const res = await gateOutAction(b.bookingId);
                    if (!res.ok) return setError(res.error);
                    setOutcome({ outcome: "message", text: "Gated out. Truck has left the facility.", tone: "done" });
                    toast.success(res.message ?? "Gated out.");
                    refresh();
                    return;
                  }
                  setDialog({
                    title: "Gate out before handling is complete",
                    description: "Handling is not complete. Why is the truck leaving?",
                    confirmLabel: "Gate out",
                    destructive: true,
                    noteRequired: true,
                    run: async ({ note }) => {
                      const res = await gateOutAction(b.bookingId, note);
                      if (res.ok) {
                        setOutcome({ outcome: "message", text: "Gated out. Truck has left the facility.", tone: "done" });
                        toast.success(res.message ?? "Gated out.");
                        refresh();
                      }
                      return res;
                    },
                  });
                }}
              >
                Gate out
              </Button>
            )}
            {!isClosed && (
              <Button
                size="lg"
                variant="destructive"
                className="h-12 text-base"
                onClick={() =>
                  setDialog({
                    title: "Flag an exception",
                    description: "The admin team is notified immediately.",
                    confirmLabel: "Flag exception",
                    destructive: true,
                    noteRequired: true,
                    withExceptionType: true,
                    notePlaceholder: "What is wrong? For example: plate on truck is AD 55 90121, pass shows AD 12345",
                    run: async ({ note, exceptionType }) => {
                      const res = await flagExceptionAction(b.bookingId, exceptionType, note);
                      if (res.ok) {
                        setOutcome({ outcome: "message", text: "Exception flagged. Hold the truck at the gate.", tone: "waiting" });
                        toast.success(res.message ?? "Exception flagged.");
                        refresh();
                      }
                      return res;
                    },
                  })
                }
              >
                Flag exception
              </Button>
            )}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent scans</div>
          <ul>
            {recent.map((r) => (
              <li key={r.reference + r.at}>
                <button type="button" className="flex w-full items-center gap-3 border-b px-4 py-2.5 text-left last:border-b-0 hover:bg-muted/60" onClick={() => { setQuery(r.reference); void lookup(r.reference); }}>
                  <span className="font-mono text-xs text-muted-foreground">{r.at}</span>
                  <span className="font-mono text-sm">{r.reference}</span>
                  <span className="text-sm">{r.plate}</span>
                  <span className={cn("ml-auto text-xs font-semibold", r.verdict === "GRANTED" ? "text-status-done" : "text-status-exception")}>{r.verdict}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ActionDialog config={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function Big({ label, value, mono, large }: { label: string; value: string; mono?: boolean; large?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("break-words", mono && "font-mono", large ? "text-2xl font-semibold" : "text-base")}>{value}</div>
    </div>
  );
}
