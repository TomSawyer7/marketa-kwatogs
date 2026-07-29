import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
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

const CreateNewPassword = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const verified = useMemo(() => {
    try {
      return sessionStorage.getItem("marketa.reset.verified") === "1";
    } catch {
      return false;
    }
  }, []);

  const allRulesPass = useMemo(
    () => passwordRules.every((r) => r.test(form.password)),
    [form.password],
  );

  useEffect(() => {
    document.title = "Create new password · Marketa";
  }, []);

  if (!verified) return <Navigate to="/forgot-password" replace />;

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
    try {
      sessionStorage.removeItem("marketa.reset.email");
      sessionStorage.removeItem("marketa.reset.sentAt");
      sessionStorage.removeItem("marketa.reset.verified");
    } catch {}
    await supabase.auth.signOut();
    toast.success("Password updated. Please log in.");
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
          <h1 className="text-2xl font-bold tracking-tight text-center">Create new password</h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Choose a strong password you haven't used before.
          </p>

          <form onSubmit={onSubmit} className="space-y-4 mt-6" noValidate>
            <div>
              <Label htmlFor="cnp-password">New password</Label>
              <Input
                id="cnp-password"
                type="password"
                autoComplete="new-password"
                maxLength={72}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                aria-invalid={!!errors.password}
                aria-describedby="cnp-password-rules"
              />
              <ul id="cnp-password-rules" className="mt-2 space-y-1">
                {passwordRules.map((r) => {
                  const ok = r.test(form.password);
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        ok ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {ok ? (
                        <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      )}
                      <span>{r.label}</span>
                    </li>
                  );
                })}
              </ul>
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password}</p>
              )}
            </div>
            <div>
              <Label htmlFor="cnp-confirm">Confirm password</Label>
              <Input
                id="cnp-confirm"
                type="password"
                autoComplete="new-password"
                maxLength={72}
                value={form.confirm}
                onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
                aria-invalid={
                  !!errors.confirm || (!!form.confirm && form.confirm !== form.password)
                }
              />
              {form.confirm && form.confirm !== form.password && !errors.confirm && (
                <p className="text-xs text-destructive mt-1">Passwords do not match</p>
              )}
              {errors.confirm && (
                <p className="text-xs text-destructive mt-1">{errors.confirm}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !allRulesPass || form.password !== form.confirm}
            >
              {busy ? "Updating…" : "Update password"}
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

export default CreateNewPassword;
