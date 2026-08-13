import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/audit";
import { checkLoginLock, registerLoginAttempt, formatLockDuration } from "@/lib/behavior";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isVerified: boolean;
  isAdmin: boolean;
  emailVerified: boolean;
  refreshStatus: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<{ error: string | null; needsEmailVerification?: boolean }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchStatus = useCallback(async (uid: string | null) => {
    if (!uid) {
      setIsVerified(false);
      setIsAdmin(false);
      return;
    }
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("is_verified").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setIsVerified(Boolean(prof?.is_verified));
    setIsAdmin(Boolean(roles?.some((r: { role: string }) => r.role === "admin")));
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      // defer DB call to avoid recursion deadlocks
      setTimeout(() => fetchStatus(s?.user?.id ?? null), 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      fetchStatus(s?.user?.id ?? null).finally(() => setLoading(false));
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchStatus]);

  const refreshStatus = useCallback(async () => {
    await fetchStatus(user?.id ?? null);
  }, [fetchStatus, user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const pre = await checkLoginLock(email);
    if (pre.locked) {
      const msg = `Account temporarily locked due to multiple failed login attempts. Try again in ${formatLockDuration(pre.seconds_remaining ?? 600)}.`;
      logEvent({ category: "auth", action: "login_blocked_locked", success: false, failure_reason: "account_locked", metadata: { email } });
      return { error: msg };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    const lock = await registerLoginAttempt(email, !error, data?.user?.id ?? null);
    logEvent({
      category: "auth",
      action: error ? "login_failure" : "login_success",
      success: !error,
      failure_reason: error?.message,
      metadata: { email },
    });
    if (error && lock.locked) {
      return { error: `Too many failed attempts. Account locked for ${formatLockDuration(lock.seconds_remaining ?? 600)}.` };
    }
    if (!error) {
      // Flip an account back to active when its scheduled deactivation window elapsed.
      try {
        await supabase.rpc("resolve_lifecycle_on_login");
      } catch {
        /* non-blocking */
      }
    }
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, firstName: string, lastName: string) => {
      const redirectUrl = `${window.location.origin}/`;
      const fullName = `${firstName} ${lastName}`.trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
            name: fullName,
          },
        },
      });
      if (error) {
        logEvent({ category: "auth", action: "register_failure", success: false, failure_reason: error.message, metadata: { email } });
        return { error: error.message };
      }
      // With "User Enumeration Protection" enabled, Supabase returns a fake
      // user with an empty identities array when the email is already taken.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        logEvent({ category: "auth", action: "register_failure", success: false, failure_reason: "email_exists", metadata: { email } });
        return { error: "That email is already registered." };
      }
      logEvent({ category: "auth", action: "register", metadata: { email } });
      return { error: null };
    },
    [],
  );

  const resetPassword = useCallback(async (email: string) => {
    // Token-only recovery email: Supabase sends the 8-digit OTP via {{ .Token }}.
    // No redirectTo so no magic link is generated.
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    logEvent({ category: "auth", action: "password_reset_request", success: !error, failure_reason: error?.message, metadata: { email } });
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    logEvent({ category: "auth", action: "password_reset_success", success: !error, failure_reason: error?.message });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    logEvent({ category: "auth", action: "logout" });
    await supabase.auth.signOut();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        loading,
        isVerified,
        isAdmin,
        emailVerified: Boolean(user?.email_confirmed_at),
        refreshStatus,
        signIn,
        signUp,
        resetPassword,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
