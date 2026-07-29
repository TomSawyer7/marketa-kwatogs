import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Lock } from "lucide-react";
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
import { useMpin } from "@/hooks/use-mpin";
import { MpinInput, MPIN_LENGTH } from "./MpinInput";

export function ForgotMpinDialog({
  open,
  onOpenChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onReset?: () => void;
}) {
  const { reauthenticate, setMpin } = useMpin();
  const [step, setStep] = useState<"password" | "mpin">("password");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = (v: boolean) => {
    if (!v) {
      setStep("password");
      setPassword("");
      setPin("");
      setConfirm("");
    }
    onOpenChange(v);
  };

  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    const { error } = await reauthenticate(password);
    setBusy(false);
    setPassword("");
    if (error) {
      toast.error(error);
      return;
    }
    setStep("mpin");
  };

  const onSubmitMpin = async (e: FormEvent) => {
    e.preventDefault();
    if (pin.length !== MPIN_LENGTH || !/^\d{6}$/.test(pin)) {
      toast.error("Enter a 6-digit MPIN.");
      return;
    }
    if (pin !== confirm) {
      toast.error("The two MPINs don't match.");
      return;
    }
    setBusy(true);
    const { error } = await setMpin(pin);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Your MPIN has been reset.");
    reset(false);
    onReset?.();
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-11 w-11 rounded-full bg-primary/10 text-primary grid place-items-center">
            {step === "password" ? <Lock className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
          </div>
          <DialogTitle className="text-center">
            {step === "password" ? "Confirm your password" : "Create a new MPIN"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "password"
              ? "For your security, resetting your MPIN requires your account password."
              : "Choose a new 6-digit MPIN. Don't reuse an obvious code."}
          </DialogDescription>
        </DialogHeader>

        {step === "password" ? (
          <form onSubmit={onPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mpin-password">Account password</Label>
              <Input
                id="mpin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy || !password}>
              {busy ? "Verifying…" : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onSubmitMpin} className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">New MPIN</p>
              <MpinInput value={pin} onChange={setPin} autoFocus disabled={busy} />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">Confirm MPIN</p>
              <MpinInput value={confirm} onChange={setConfirm} disabled={busy} />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={busy || pin.length !== MPIN_LENGTH || confirm.length !== MPIN_LENGTH}
            >
              {busy ? "Saving…" : "Save MPIN"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
