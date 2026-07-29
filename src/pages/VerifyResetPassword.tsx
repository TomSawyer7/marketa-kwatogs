import { ClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const LENGTH = 8;
const RESEND_SECONDS = 60;

const VerifyResetPassword = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const email = useMemo(() => {
    try {
      return sessionStorage.getItem("marketa.reset.email") || "";
    } catch {
      return "";
    }
  }, []);

  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    document.title = "Verify code · Marketa";
    inputsRef.current[0]?.focus();
  }, []);

  // Initialize cooldown from the last send time so a page refresh doesn't bypass it.
  useEffect(() => {
    try {
      const sentAt = Number(sessionStorage.getItem("marketa.reset.sentAt") || 0);
      if (sentAt) {
        const elapsed = Math.floor((Date.now() - sentAt) / 1000);
        const remaining = RESEND_SECONDS - elapsed;
        if (remaining > 0) setCooldown(remaining);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  if (!email) return <Navigate to="/forgot-password" replace />;

  const setDigitAt = (i: number, v: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };

  const onChange = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, "");
    if (!v) {
      setDigitAt(i, "");
      return;
    }
    if (v.length === 1) {
      setDigitAt(i, v);
      if (i < LENGTH - 1) inputsRef.current[i + 1]?.focus();
    } else {
      // typed/pasted multiple chars into one box — spread across
      const chars = v.slice(0, LENGTH - i).split("");
      setDigits((prev) => {
        const next = [...prev];
        chars.forEach((c, k) => (next[i + k] = c));
        return next;
      });
      const nextIdx = Math.min(i + chars.length, LENGTH - 1);
      inputsRef.current[nextIdx]?.focus();
    }
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        setDigitAt(i, "");
      } else if (i > 0) {
        inputsRef.current[i - 1]?.focus();
        setDigitAt(i - 1, "");
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputsRef.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < LENGTH - 1) {
      inputsRef.current[i + 1]?.focus();
    } else if (e.key === "Enter") {
      submit();
    }
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    const chars = text.slice(0, LENGTH - i).split("");
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((c, k) => (next[i + k] = c));
      return next;
    });
    const nextIdx = Math.min(i + chars.length, LENGTH - 1);
    inputsRef.current[nextIdx]?.focus();
  };

  const submit = async () => {
    const token = digits.join("");
    if (token.length !== LENGTH) {
      setError(`Enter the ${LENGTH}-digit code.`);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "recovery",
    });
    setBusy(false);
    if (err) {
      const msg = /expired/i.test(err.message)
        ? "That code has expired. Request a new one."
        : /invalid|token/i.test(err.message)
          ? "Invalid verification code."
          : err.message;
      setError(msg);
      toast.error(msg);
      return;
    }
    try {
      sessionStorage.setItem("marketa.reset.verified", "1");
    } catch {}
    toast.success("Code verified.");
    navigate("/create-new-password", { replace: true });
  };

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    const { error: err } = await resetPassword(email);
    setResending(false);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      sessionStorage.setItem("marketa.reset.sentAt", String(Date.now()));
    } catch {}
    setCooldown(RESEND_SECONDS);
    toast.success("A new code has been sent.");
  };

  return (
    <div className="min-h-screen bg-secondary/40 grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">Marketa</span>
        </Link>

        <div className="bg-card border border-border rounded-xl shadow-sm p-6 md:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-center">Enter verification code</h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            We sent an 8-digit code to <span className="text-foreground font-medium">{email}</span>.
          </p>

          <div
            className="mt-6 grid grid-cols-8 gap-1.5 sm:gap-2"
            onSubmit={(e) => e.preventDefault()}
          >
            {digits.map((d, i) => (
              <Input
                key={i}
                ref={(el) => (inputsRef.current[i] = el)}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={1}
                value={d}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => onPaste(i, e)}
                className="h-12 sm:h-14 text-center text-lg font-semibold px-0"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>
          {error && <p className="text-xs text-destructive mt-3 text-center">{error}</p>}

          <Button
            type="button"
            className="w-full mt-6"
            disabled={busy || digits.join("").length !== LENGTH}
            onClick={submit}
          >
            {busy ? "Verifying…" : "Verify code"}
          </Button>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Didn't get it?{" "}
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0 || resending}
              className="text-primary font-medium hover:underline disabled:opacity-60 disabled:no-underline disabled:cursor-not-allowed"
            >
              {resending
                ? "Resending…"
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend code"}
            </button>
          </div>
        </div>

        <div className="text-center mt-4">
          <Link
            to="/forgot-password"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Use a different email
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyResetPassword;
