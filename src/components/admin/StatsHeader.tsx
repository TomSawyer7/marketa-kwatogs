import { Clock, Video, CheckCircle2, XCircle } from "lucide-react";

type Stats = { pending: number; awaiting_liveness: number; verified: number; rejected: number };

export function StatsHeader({ stats }: { stats: Stats }) {
  const items = [
    { label: "Ready for review", value: stats.pending, icon: Clock, accent: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    { label: "Awaiting liveness", value: stats.awaiting_liveness, icon: Video, accent: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    { label: "Verified", value: stats.verified, icon: CheckCircle2, accent: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, accent: "text-destructive", bg: "bg-destructive/10" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {items.map((it) => (
        <div key={it.label} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
          <div className={`h-9 w-9 rounded-md grid place-items-center ${it.bg} ${it.accent} shrink-0`}>
            <it.icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{it.label}</p>
            <p className="text-lg font-semibold leading-tight">{it.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
