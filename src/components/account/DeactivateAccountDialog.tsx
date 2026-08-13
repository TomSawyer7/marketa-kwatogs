import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, PauseCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MpinInput, MPIN_LENGTH } from "@/components/mpin/MpinInput";
import { useMpin } from "@/hooks/use-mpin";
import { useAccountLifecycle } from "@/hooks/use-account-lifecycle";
import { useAuth } from "@/hooks/use-auth";

type Step = "duration" | "mpin" | "password";

const DURATIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "indefinite", label: "Indefinite — until I reactivate" },
];

export function DeactivateAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { verify, reauthenticate } = useMpin();
  const { deactivate } = useAccountLifecycle();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("duration");
  const [duration, setDuration] = useState("30");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // keep the verified MPIN around for the server-side re-check in the RPC
  const pinRef = useRef("");

  const close = (v: boolean) => {
    if (!v) {
      setStep("duration");
      setDuration("30");
      setPin("");
      setPassword("");
    }
    onOpenChange(v);
  };

  const onMpin = async (value: string) => {
    setBusy(true);
    const res = await verify(value);
    setBusy(false);
    setPin("");
    if (!res.ok) {
      toast.error(res.locked ? "Too many attempts. Try again later." : "Incorrect MPIN.");
      return;
    }
    setStep("password");
  };

  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    const auth = await reauthenticate(password);
    if (auth.error) {
      setBusy(false);
      toast.error(auth.error);
      return;
    }
    const days = duration === "indefinite" ? null : Number(duration);
    const { error } = await deactivate(pinRef.current, days);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (days) {
      const until = new Date(Date.now() + days * 86_400_000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      toast.success(`Your account is deactivated and will be hidden until ${until}.`);
    } else {
      toast.success("Your account is deactivated and stays hidden until you reactivate it.");
    }
    close(false);
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5" /> Deactivate account
          </DialogTitle>
          <DialogDescription>
            Your profile and listings are hidden from the marketplace. Nothing is deleted and you
            can come back any time.
          </DialogDescription>
        </DialogHeader>

        {step === "duration" && (
          <div className="space-y-4">
            <div>
              <Label>How long?</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">
                {duration === "indefinite"
                  ? "Your account stays hidden until you reactivate it yourself."
                  : `Your account reactivates automatically after ${duration} days.`}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep("mpin")}>Continue</Button>
            </div>
          </div>
        )}

        {step === "mpin" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">Enter your 6-digit MPIN.</p>
            <MpinInput
              value={pin}
              onChange={(v) => {
                setPin(v);
                pinRef.current = v;
              }}
              autoFocus
              disabled={busy}
              onComplete={onMpin}
            />
          </div>
        )}

        {step === "password" && (
          <form onSubmit={onPassword} className="space-y-4">
            <div>
              <Label htmlFor="deact-pass">Account password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="deact-pass"
                  type="password"
                  autoFocus
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || password.length < 1}>
                {busy ? "Deactivating…" : "Deactivate account"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
