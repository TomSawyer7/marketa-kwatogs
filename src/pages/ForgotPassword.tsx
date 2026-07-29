import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(120),
});

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Forgot password · Marketa";
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await resetPassword(parsed.data.email);
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      sessionStorage.setItem("marketa.reset.email", parsed.data.email);
      sessionStorage.setItem("marketa.reset.sentAt", String(Date.now()));
      sessionStorage.removeItem("marketa.reset.verified");
    } catch {}
    toast.success("We emailed you an 8-digit code.");
    navigate("/verify-reset-password", { replace: true });
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
          <h1 className="text-2xl font-bold tracking-tight text-center">Forgot password</h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Enter your email and we'll send you an 8-digit verification code.
          </p>

          <form onSubmit={onSubmit} className="space-y-4 mt-6">
            <div>
              <Label htmlFor="fp-email">Email</Label>
              <Input
                id="fp-email"
                type="email"
                autoComplete="email"
                maxLength={120}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <p className="text-xs text-destructive mt-1">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send verification code"}
            </Button>
          </form>
        </div>

        <div className="text-center mt-4">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to log in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
