import { useState } from "react";
import { PauseCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAccountLifecycle } from "@/hooks/use-account-lifecycle";

function fmt(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AccountLifecycleBanner() {
  const { user } = useAuth();
  const { lifecycle, isDeactivated, isPendingDeletion, daysLeft, reactivate, cancelDeletion } =
    useAccountLifecycle();
  const [busy, setBusy] = useState(false);

  if (!user || (!isDeactivated && !isPendingDeletion)) return null;

  const run = async (fn: () => Promise<{ error: string | null }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) toast.error(error);
    else toast.success(ok);
  };

  if (isPendingDeletion) {
    const on = fmt(lifecycle?.delete_after ?? null);
    return (
      <div className="border-b bg-destructive/10 border-destructive/30">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm">
          <Trash2 className="h-4 w-4 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium">Your account is scheduled for deletion.</span>{" "}
            <span className="text-muted-foreground">
              It will be permanently anonymized in {daysLeft ?? 0} day
              {daysLeft === 1 ? "" : "s"}
              {on ? ` (on ${on})` : ""}. You can still cancel until then.
            </span>
          </div>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() =>
              run(cancelDeletion, "Deletion cancelled — your account is active again.")
            }
          >
            Cancel deletion
          </Button>
        </div>
      </div>
    );
  }

  const until = fmt(lifecycle?.reactivate_at ?? null);

  return (
    <div className="border-b bg-yellow-500/10 border-yellow-500/30">
      <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm">
        <PauseCircle className="h-4 w-4 text-yellow-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium">Your account is deactivated.</span>{" "}
          <span className="text-muted-foreground">
            {until
              ? `Your profile and listings are hidden until ${until}, when they come back automatically.`
              : "Your profile and listings are hidden until you reactivate them."}
          </span>
        </div>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => run(reactivate, "Welcome back — your account is active again.")}
        >
          Reactivate now
        </Button>
      </div>
    </div>
  );
}
