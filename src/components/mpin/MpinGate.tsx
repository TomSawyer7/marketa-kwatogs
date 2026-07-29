import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMpin, type MpinSection } from "@/hooks/use-mpin";
import { MpinInput, MPIN_LENGTH } from "./MpinInput";
import { ForgotMpinDialog } from "./ForgotMpinDialog";

const LABELS: Record<MpinSection, string> = {
  inbox: "Inbox",
  sell: "Add Listing",
  settings: "Settings",
};

export function MpinGate({
  section,
  children,
}: {
  section: MpinSection;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { loading, status, isUnlocked, unlock, verify } = useMpin();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const unlocked = isUnlocked(section);

  useEffect(() => {
    if (status?.locked) setLocked(true);
  }, [status]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  // No MPIN configured yet (e.g. admin accounts) → nothing to gate.
  if (unlocked || !status?.has_mpin) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pin.length !== MPIN_LENGTH) return;
    setBusy(true);
    const result = await verify(pin, section);
    setBusy(false);
    setPin("");
    if (result.ok) {
      unlock(section);
      return;
    }
    setAttemptsLeft(result.attempts_left);
    setLocked(result.locked);
    toast.error(
      result.locked
        ? "Too many attempts. Reset your MPIN with your password."
        : `Incorrect MPIN. ${result.attempts_left} attempt(s) left.`,
    );
    if (result.locked) setForgotOpen(true);
  };

  return (
    <div className="min-h-screen bg-secondary/40 grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 md:p-8">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-center mt-4">
            Enter your MPIN
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Confirm it's really you before opening{" "}
            <span className="font-medium text-foreground">{LABELS[section]}</span>.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <MpinInput
              value={pin}
              onChange={setPin}
              autoFocus
              disabled={busy || locked}
            />
            {locked ? (
              <p className="text-xs text-center text-destructive">
                MPIN locked after 5 failed attempts. Reset it with your account password.
              </p>
            ) : attemptsLeft !== null ? (
              <p className="text-xs text-center text-destructive">
                Incorrect MPIN — {attemptsLeft} attempt(s) remaining.
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || locked || pin.length !== MPIN_LENGTH}
            >
              {busy ? "Checking…" : "Unlock"}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-primary font-medium hover:underline"
            >
              Forgot MPIN?
            </button>
            <button
              type="button"
              onClick={() => navigate("/browse")}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <ForgotMpinDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        onReset={() => {
          setLocked(false);
          setAttemptsLeft(null);
          unlock(section);
        }}
      />
    </div>
  );
}
