import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import { useAuth } from "@/hooks/use-auth";
import { recordAcceptance } from "@/lib/legal";
import { supabase } from "@/integrations/supabase/client";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(120),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(40),
    lastName: z.string().trim().min(1, "Last name is required").max(40),
    email: z.string().trim().email("Enter a valid email").max(120),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72)
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/\d/, "Password must contain a number")
      .regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

const PUBLIC_PATHS = new Set(["/", "/auth", "/forgot-password", "/reset-password"]);

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, isVerified, isAdmin, emailVerified, signIn, signUp, refreshStatus } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);

  const [login, setLogin] = useState({ email: "", password: "" });
  const [signup, setSignup] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirm: "",
  });

  const requestedFrom = (location.state as { from?: string } | null)?.from;

  const destinationFor = (verified: boolean, admin: boolean, emailOk: boolean) => {
    if (admin) return "/admin";
    if (!emailOk) return "/verify-email";
    if (verified) {
      if (requestedFrom && !PUBLIC_PATHS.has(requestedFrom)) return requestedFrom;
      return "/browse";
    }
    return "/verify";
  };

  useEffect(() => {
    if (!loading && user) {
      navigate(destinationFor(isVerified, isAdmin, emailVerified), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isVerified, isAdmin, emailVerified, navigate]);

  useEffect(() => {
    document.title = tab === "login" ? "Log in · Marketa" : "Sign up · Marketa";
  }, [tab]);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(login);
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
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setBusy(false);
    if (error) {
      const msg = /invalid/i.test(error) ? "Invalid email or password." : error;
      toast.error(msg);
      return;
    }
    toast.success("Welcome back!");
    // Redirect handled by the useEffect once verification status loads.
    await refreshStatus();
  };

  const onSignup = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(signup);
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
    const { error } = await signUp(
      parsed.data.email,
      parsed.data.password,
      parsed.data.firstName,
      parsed.data.lastName,
    );
    setBusy(false);
    if (error) {
      const msg = /already/i.test(error) ? "That email is already registered." : error;
      toast.error(msg);
      return;
    }
    toast.success("Account created! Check your email for a verification code.");
    navigate("/verify-email", { state: { email: parsed.data.email } });
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
          <h1 className="text-2xl font-bold tracking-tight text-center">Welcome to Marketa</h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Buy and sell with people in your area.
          </p>

          <Tabs value={tab} onValueChange={(v) => { setTab(v as "login" | "signup"); setErrors({}); }} className="mt-6">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Log in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-5">
              <form onSubmit={onLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email" type="email" autoComplete="email" maxLength={120}
                    value={login.email}
                    onChange={(e) => setLogin((p) => ({ ...p, email: e.target.value }))}
                  />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password" type="password" autoComplete="current-password" maxLength={72}
                    value={login.password}
                    onChange={(e) => setLogin((p) => ({ ...p, password: e.target.value }))}
                  />
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                  <div className="mt-1.5 text-right">
                    <Link
                      to="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Logging in…" : "Log in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form onSubmit={onSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="signup-first">First name</Label>
                    <Input
                      id="signup-first" autoComplete="given-name" maxLength={40}
                      value={signup.firstName}
                      onChange={(e) => setSignup((p) => ({ ...p, firstName: e.target.value }))}
                    />
                    {errors.firstName && <p className="text-xs text-destructive mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="signup-last">Last name</Label>
                    <Input
                      id="signup-last" autoComplete="family-name" maxLength={40}
                      value={signup.lastName}
                      onChange={(e) => setSignup((p) => ({ ...p, lastName: e.target.value }))}
                    />
                    {errors.lastName && <p className="text-xs text-destructive mt-1">{errors.lastName}</p>}
                  </div>
                </div>
                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email" type="email" autoComplete="email" maxLength={120}
                    value={signup.email}
                    onChange={(e) => setSignup((p) => ({ ...p, email: e.target.value }))}
                  />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password" type="password" autoComplete="new-password" maxLength={72}
                    value={signup.password}
                    onChange={(e) => setSignup((p) => ({ ...p, password: e.target.value }))}
                  />
                  <PasswordStrengthMeter password={signup.password} />
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                </div>
                <div>
                  <Label htmlFor="signup-confirm">Confirm password</Label>
                  <Input
                    id="signup-confirm" type="password" autoComplete="new-password" maxLength={72}
                    value={signup.confirm}
                    onChange={(e) => setSignup((p) => ({ ...p, confirm: e.target.value }))}
                  />
                  {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
        </div>

        <div className="text-center mt-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to marketplace
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
