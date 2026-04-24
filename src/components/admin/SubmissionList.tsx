import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { StatusBadge, EverifyBadge, type VerificationStatus, type EverifyStatus } from "./StatusBadges";

export type ListItem = {
  user_id: string;
  status: VerificationStatus;
  everify_status: EverifyStatus;
  ocr_full_name: string | null;
  submitted_at: string;
};

type FilterKey = "all" | VerificationStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "id_approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export function SubmissionList({
  items,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: {
  items: ListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  search: string;
  onSearchChange: (s: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-border space-y-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or user ID…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={cn(
                "text-[11px] font-medium px-2 py-1 rounded-md transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {items.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No submissions match.</div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <li key={it.user_id}>
                <button
                  onClick={() => onSelect(it.user_id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors block",
                    selectedId === it.user_id && "bg-accent/40 border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{it.ocr_full_name || "Unknown"}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(it.submitted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <StatusBadge status={it.status} />
                    <EverifyBadge status={it.everify_status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export type { FilterKey };
