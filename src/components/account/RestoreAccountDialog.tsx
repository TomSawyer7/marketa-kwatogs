import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useAccountLifecycle } from "@/hooks/use-account-lifecycle";

export function RestoreAccountDialog() {
  const { user } = useAuth();
  const { isDeactivated, isPendingDeletion, reactivate, cancelDeletion } = useAccountLifecycle();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const hidden = isDeactivated || isPendingDeletion;

  useEffect(() => {
    if (user && hidden && !dismissed) setOpen(true);
    if (!hidden) {
      setOpen(false);
      setDismissed(false);
    }
  }, [user, hidden, dismissed]);

  if (!user || !hidden) return null;

  const restore = async () => {
    setBusy(true);
    const { error } = isPendingDeletion ? await cancelDeletion() : await reactivate();
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Welcome back — your account and listings are live again.");
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && (setOpen(false), setDismissed(true))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Welcome back!</AlertDialogTitle>
          <AlertDialogDescription>
            Your account is currently{" "}
            {isPendingDeletion ? "scheduled for deletion" : "deactivated"}. Would you like to
            restore your account and re-list your items?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Not now</AlertDialogCancel>
          <AlertDialogAction onClick={restore} disabled={busy}>
            {busy ? "Restoring…" : "Restore my account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
