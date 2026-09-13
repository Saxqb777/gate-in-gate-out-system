"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";

const GREEN = "#739A41";
const BLUE = "#2f6db0";
const AMBER = "#b7791f";
const RED = "#b3412f";
const axis = { fontSize: 11, fill: "#6b7268" };

export function TrucksPerDayChart({ data }: { data: { day: string; inbound: number; outbound: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data.map((d) => ({ ...d, label: d.day.slice(5) }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e3e6e0" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip cursor={{ fill: "#f0f2ee" }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e3e6e0" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="inbound" name="Inbound" stackId="a" fill={BLUE} isAnimationActive={false} />
        <Bar dataKey="outbound" name="Outbound" stackId="a" fill={GREEN} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TurnaroundChart({ data }: { data: { day: string; avgGate: number; avgDock: number; avgHandling: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data.map((d) => ({ ...d, label: d.day.slice(5) }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e3e6e0" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} unit="m" />
        <Tooltip cursor={{ fill: "#f0f2ee" }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e3e6e0" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="avgGate" name="Gate to gate" fill={GREEN} isAnimationActive={false} />
        <Bar dataKey="avgDock" name="Dock time" fill={BLUE} isAnimationActive={false} />
        <Bar dataKey="avgHandling" name="Handling" fill={AMBER} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function UtilisationChart({ data }: { data: { code: string; utilisation: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="#e3e6e0" />
        <XAxis type="number" domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} unit="%" />
        <YAxis type="category" dataKey="code" tick={{ ...axis, fontFamily: "monospace" }} tickLine={false} axisLine={false} width={64} />
        <Tooltip cursor={{ fill: "#f0f2ee" }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e3e6e0" }} formatter={(v) => [`${v}%`, "Utilisation"]} />
        <Bar dataKey="utilisation" fill={GREEN} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PunctualityChart({ data }: { data: { carrier: string; early: number; on_time: number; late: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="#e3e6e0" />
        <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="carrier" tick={axis} tickLine={false} axisLine={false} width={140} />
        <Tooltip cursor={{ fill: "#f0f2ee" }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e3e6e0" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="on_time" name="On time" stackId="a" fill={GREEN} isAnimationActive={false} />
        <Bar dataKey="early" name="Early" stackId="a" fill={AMBER} isAnimationActive={false} />
        <Bar dataKey="late" name="Late" stackId="a" fill={RED} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DownloadCsv({ filename, header, rows }: { filename: string; header: string[]; rows: (string | number)[][] }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
        const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      Download CSV
    </Button>
  );
}
