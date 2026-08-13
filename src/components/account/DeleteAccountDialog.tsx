import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, Mail, Trash2 } from "lucide-react";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MpinInput } from "@/components/mpin/MpinInput";
import { useMpin } from "@/hooks/use-mpin";
import { useAccountLifecycle } from "@/hooks/use-account-lifecycle";
import { useAuth } from "@/hooks/use-auth";

const OTP_LENGTH = 8;

type Step = "intro" | "mpin" | "password" | "otp" | "confirm";

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { verify, reauthenticate, sendResetOtp, verifyResetOtp, email } = useMpin();
  const { requestDeletion } = useAccountLifecycle();

  const [step, setStep] = useState<Step>("intro");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const pinRef = useRef("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const close = (v: boolean) => {
    if (!v) {
      setStep("intro");
      setPin("");
      setPassword("");
      setCode("");
      setTyped("");
      setResendIn(0);
      pinRef.current = "";
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

  const sendCode = async () => {
    if (resendIn > 0) return;
    setBusy(true);
    const { error } = await sendResetOtp();
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setCode("");
    setResendIn(30);
    toast.success(`We sent an ${OTP_LENGTH}-digit code to your email.`);
  };

  const onPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    const { error } = await reauthenticate(password);
    setPassword("");
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setStep("otp");
    void sendCode();
  };

  const onOtp = async (value: string) => {
    setBusy(true);
    const { error } = await verifyResetOtp(value);
    setBusy(false);
    if (error) {
      toast.error(error);
      setCode("");
      return;
    }
    setStep("confirm");
  };

  const onConfirm = async () => {
    setBusy(true);
    const { error } = await requestDeletion(pinRef.current);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Deletion requested. You have 30 days to change your mind.");
    close(false);
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> Delete account permanently
          </DialogTitle>
          <DialogDescription>
            This starts a 30-day grace period. Your account is hidden immediately and you can cancel
            at any point during those 30 days.
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
              <li>Your name, email and profile details are replaced with “Deleted User”.</li>
              <li>Your ID images, extracted KYC data and liveness recordings are erased for good.</li>
              <li>
                Transaction, order and listing history is kept for accounting and legal reasons,
                attributed to “Deleted User”.
              </li>
              <li>This cannot be undone once the 30 days pass.</li>
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setStep("mpin")}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "mpin" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Step 1 of 3 — enter your 6-digit MPIN.
            </p>
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
            <p className="text-sm text-muted-foreground">Step 2 of 3 — confirm your password.</p>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                autoFocus
                className="pl-9"
                placeholder="Account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={busy || !password}>
                Continue
              </Button>
            </div>
          </form>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Step 3 of 3 — enter the {OTP_LENGTH}-digit code sent to {email}.
            </p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={OTP_LENGTH}
                value={code}
                onChange={setCode}
                onComplete={onOtp}
                disabled={busy}
                autoFocus
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="text-center">
              <Button variant="link" size="sm" onClick={sendCode} disabled={busy || resendIn > 0}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </Button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <Label htmlFor="type-delete">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm.
            </Label>
            <Input
              id="type-delete"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={onConfirm}
                disabled={busy || typed !== "DELETE"}
              >
                {busy ? "Submitting…" : "Delete my account"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
