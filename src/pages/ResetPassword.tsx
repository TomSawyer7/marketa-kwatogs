import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Check, Store, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const passwordRules = [
  { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "upper", label: "One uppercase letter (A–Z)", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", label: "One lowercase letter (a–z)", test: (v: string) => /[a-z]/.test(v) },
  { id: "number", label: "One number (0–9)", test: (v: string) => /\d/.test(v) },
  { id: "special", label: "One special character (!@#$…)", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

const schema = z
  .object({
    password: z
      .string()
      .max(72, "Password is too long")
      .refine((v) => passwordRules.every((r) => r.test(v)), {
        message: "Password does not meet all requirements",
      }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Reset password · Marketa";
  }, []);

  useEffect(() => {
    // Supabase puts a recovery token in the URL hash and triggers PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovering(true);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const hash = window.location.hash || "";
      if (hash.includes("type=recovery") || session) {
        setReady(true);
        if (hash.includes("type=recovery")) setRecovering(true);
      } else {
        setReady(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0] as string;
        if (!fe[k]) fe[k] = i.message;
      });
      setErrors(fe);
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await updatePassword(parsed.data.password);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Password updated. Please log in.");
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
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
          <h1 className="text-2xl font-bold tracking-tight text-center">Set a new password</h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            {recovering
              ? "Choose a strong password you haven't used before."
              : "Open the reset link from your email to continue."}
          </p>

          {ready && (
            <form onSubmit={onSubmit} className="space-y-4 mt-6">
              <div>
                <Label htmlFor="rp-password">New password</Label>
                <Input
                  id="rp-password"
                  type="password"
                  autoComplete="new-password"
                  maxLength={72}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                />
                {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
              </div>
              <div>
                <Label htmlFor="rp-confirm">Confirm password</Label>
                <Input
                  id="rp-confirm"
                  type="password"
                  autoComplete="new-password"
                  maxLength={72}
                  value={form.confirm}
                  onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
                />
                {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
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

export default ResetPassword;
