import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Store, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const OTP_LENGTH = 8;

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, emailVerified, isVerified, isAdmin, refreshStatus } = useAuth();

  const stateEmail = (location.state as { email?: string } | null)?.email;
  const email = stateEmail || user?.email || "";

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    document.title = "Verify email · Marketa";
  }, []);

  useEffect(() => {
    if (loading) return;
    // Already verified email → move on to KYC / marketplace
    if (user && (emailVerified || isAdmin)) {
      navigate(isAdmin || isVerified ? "/browse" : "/verify", { replace: true });
    }
    if (!user && !email) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, emailVerified, isAdmin, isVerified, email, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }
    if (!email) {
      toast.error("Missing email address. Please sign in again.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Invalid or expired code.");
      return;
    }
    toast.success("Email verified!");
    await refreshStatus();
    navigate("/verify", { replace: true });
  };

  const onResend = async () => {
    if (!email || resendIn > 0) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Could not resend code.");
      return;
    }
    toast.success("A new code has been sent.");
    setResendIn(30);
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
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center mt-4">Verify your email</h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            We sent an {OTP_LENGTH}-digit verification code to
            <br />
            <span className="font-medium text-foreground">{email || "your email"}</span>
          </p>

          <form onSubmit={onVerify} className="mt-6 space-y-5">
            <div className="flex justify-center">
              <InputOTP
                maxLength={OTP_LENGTH}
                value={code}
                onChange={setCode}
                autoFocus
                inputMode="numeric"
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button type="submit" className="w-full" disabled={busy || code.length !== OTP_LENGTH}>
              {busy ? "Verifying…" : "Verify email"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            Didn't receive it?{" "}
            <button
              type="button"
              onClick={onResend}
              disabled={busy || resendIn > 0}
              className="text-primary font-medium hover:underline disabled:opacity-60 disabled:no-underline"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </button>
          </div>
        </div>

        <div className="text-center mt-4">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
            ← Use a different email
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
