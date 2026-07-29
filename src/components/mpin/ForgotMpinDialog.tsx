import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Lock, Mail, Send } from "lucide-react";
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
import { useMpin } from "@/hooks/use-mpin";
import { MpinInput, MPIN_LENGTH } from "./MpinInput";

const OTP_LENGTH = 8;

type Step = "send" | "otp" | "password" | "mpin";

export function ForgotMpinDialog({
  open,
  onOpenChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onReset?: () => void;
}) {
  const { reauthenticate, setMpin, sendResetOtp, verifyResetOtp, email } = useMpin();
  const [step, setStep] = useState<Step>("send");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const autoSentRef = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const reset = (v: boolean) => {
    if (!v) {
      setStep("send");
      setPassword("");
      setCode("");
      setPin("");
      setConfirm("");
      setResendIn(0);
      autoSentRef.current = false;
    }
    onOpenChange(v);
  };

  const onSendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (resendIn > 0) return;
    setBusy(true);
    const { error } = await sendResetOtp();
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setCode("");
    toast.success(`We sent a ${OTP_LENGTH}-digit code to your email.`);
    setResendIn(30);
    setStep("otp");
  };

  useEffect(() => {
    if (!open || step !== "send" || autoSentRef.current) return;
    autoSentRef.current = true;
    void onSendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

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
    setStep("mpin");
  };

  const onResend = async () => {
    await onSendCode();
  };

  const onOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) return;
    setBusy(true);
    const { error } = await verifyResetOtp(code);
    setBusy(false);
    if (error) {
      setCode("");
      toast.error(error);
      return;
    }
    toast.success("Code verified. Confirm your password to continue.");
    setStep("password");
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

  const icon =
    step === "send"
      ? <Send className="h-5 w-5" />
      : step === "otp"
        ? <Mail className="h-5 w-5" />
        : step === "password"
          ? <Lock className="h-5 w-5" />
          : <KeyRound className="h-5 w-5" />;

  const title =
    step === "send"
      ? "Reset your MPIN"
      : step === "otp"
        ? "Check your email"
        : step === "password"
          ? "Confirm your password"
        : "Create a new MPIN";

  const description =
    step === "send"
      ? `We'll send an ${OTP_LENGTH}-digit code to ${email ?? "your registered email"}.`
      : step === "otp"
        ? `Enter the ${OTP_LENGTH}-digit code we sent to ${email ?? "your email"}.`
        : step === "password"
          ? "For your security, confirm your account password before creating a new MPIN."
        : "Choose a new 6-digit MPIN. Don't reuse an obvious code.";

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-11 w-11 rounded-full bg-primary/10 text-primary grid place-items-center">
            {icon}
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>

        {step === "send" && (
          <form onSubmit={onSendCode} className="space-y-4">
            <Button type="submit" className="w-full" disabled={busy || !email}>
              {busy ? "Sending…" : "Send verification code"}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={onOtp} className="space-y-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={OTP_LENGTH}
                value={code}
                onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                autoFocus
                disabled={busy}
                inputMode="numeric"
                pattern="[0-9]*"
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} className="h-11 w-9 text-base" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" className="w-full" disabled={busy || code.length !== OTP_LENGTH}>
              {busy ? "Verifying…" : "Verify code"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Didn't receive it?{" "}
              <button
                type="button"
                onClick={onResend}
                disabled={busy || resendIn > 0}
                className="text-primary font-medium hover:underline disabled:opacity-60 disabled:no-underline"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </p>
          </form>
        )}

        {step === "password" && (
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
        )}

        {step === "mpin" && (
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
