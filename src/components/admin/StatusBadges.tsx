import { Badge } from "@/components/ui/badge";

export type VerificationStatus = "awaiting_liveness" | "pending" | "id_approved" | "verified" | "rejected";
export type EverifyStatus = "not_checked" | "passed" | "failed";

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const map = {
    awaiting_liveness: { label: "Awaiting liveness", cls: "bg-muted text-muted-foreground border-border" },
    pending: { label: "Ready for review", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
    id_approved: { label: "ID approved", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30" },
    verified: { label: "Verified", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
    rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  } as const;
  const m = map[status] ?? map.pending;
  return <Badge variant="outline" className={`${m.cls} text-[10px] px-1.5 py-0 h-5 font-medium`}>{m.label}</Badge>;
}

export function EverifyBadge({ status }: { status: EverifyStatus }) {
  if (status === "not_checked") {
    return <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] px-1.5 py-0 h-5 font-medium">eVerify ·</Badge>;
  }
  if (status === "passed") {
    return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 h-5 font-medium">eVerify ✓</Badge>;
  }
  return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] px-1.5 py-0 h-5 font-medium">eVerify ✗</Badge>;
}
