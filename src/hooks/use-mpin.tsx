import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logEvent } from "@/lib/audit";

export type MpinSection = "inbox" | "sell" | "settings";

export type MpinStatus = {
  has_mpin: boolean;
  locked: boolean;
  attempts_left: number;
};

export type VerifyResult = MpinStatus & { ok: boolean };

type MpinResetOtpResult = {
  ok?: boolean;
  message?: string;
};

type MpinCtx = {
  loading: boolean;
  status: MpinStatus | null;
  refresh: () => Promise<void>;
  isUnlocked: (section: MpinSection) => boolean;
  unlock: (section: MpinSection) => void;
  lockAll: () => void;
  verify: (mpin: string, section?: MpinSection) => Promise<VerifyResult>;
  setMpin: (mpin: string) => Promise<{ error: string | null }>;
  reauthenticate: (password: string) => Promise<{ error: string | null }>;
  sendResetOtp: () => Promise<{ error: string | null }>;
  verifyResetOtp: (code: string) => Promise<{ error: string | null }>;
  email: string | null;
};

const Ctx = createContext<MpinCtx | null>(null);

const STORAGE_KEY = "marketa.mpin.unlocked";

function readUnlocked(uid: string | null): MpinSection[] {
  if (!uid || typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_KEY}.${uid}`);
    return raw ? (JSON.parse(raw) as MpinSection[]) : [];
  } catch {
    return [];
  }
}

function writeUnlocked(uid: string | null, sections: MpinSection[]) {
  if (!uid || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${STORAGE_KEY}.${uid}`, JSON.stringify(sections));
  } catch {
    /* ignore */
  }
}

export function MpinProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.id ?? null;

  const [status, setStatus] = useState<MpinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState<MpinSection[]>([]);

  useEffect(() => {
    if (!uid && typeof window !== "undefined") {
      // signed out → drop every cached section unlock
      Object.keys(window.sessionStorage)
        .filter((k) => k.startsWith(STORAGE_KEY))
        .forEach((k) => window.sessionStorage.removeItem(k));
    }
    setUnlocked(readUnlocked(uid));
  }, [uid]);


  const refresh = useCallback(async () => {
    if (!uid) {
      setStatus(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("mpin_status");
    if (error) {
      setStatus(null);
    } else {
      setStatus(data as unknown as MpinStatus);
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    refresh();
  }, [authLoading, refresh]);

  const isUnlocked = useCallback(
    (section: MpinSection) => unlocked.includes(section),
    [unlocked],
  );

  const unlock = useCallback(
    (section: MpinSection) => {
      setUnlocked((prev) => {
        if (prev.includes(section)) return prev;
        const next = [...prev, section];
        writeUnlocked(uid, next);
        return next;
      });
    },
    [uid],
  );

  const lockAll = useCallback(() => {
    setUnlocked([]);
    writeUnlocked(uid, []);
  }, [uid]);

  const verify = useCallback(
    async (mpin: string, section?: MpinSection): Promise<VerifyResult> => {
      const { data, error } = await supabase.rpc("verify_mpin", { _mpin: mpin });
      if (error) {
        logEvent({ category: "auth", action: "mpin_verify_failure", success: false, failure_reason: error.message });
        return { ok: false, has_mpin: true, locked: false, attempts_left: 0 };
      }
      const result = data as unknown as VerifyResult;
      setStatus({
        has_mpin: result.has_mpin,
        locked: result.locked,
        attempts_left: result.attempts_left,
      });
      if (result.ok && section) unlock(section);
      logEvent({
        category: "auth",
        action: result.ok ? "mpin_verify_success" : (result.locked ? "account_lockout" : "mpin_verify_failure"),
        success: result.ok,
        metadata: { section, attempts_left: result.attempts_left },
      });
      return result;
    },
    [unlock],
  );

  const setMpin = useCallback(
    async (mpin: string) => {
      const { error } = await supabase.rpc("set_mpin", { _mpin: mpin });
      if (error) {
        logEvent({ category: "auth", action: "mpin_create_failure", success: false, failure_reason: error.message });
        return { error: error.message };
      }
      logEvent({ category: "auth", action: "mpin_create" });
      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const reauthenticate = useCallback(
    async (password: string) => {
      if (!user?.email) return { error: "No email on this account." };
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      return { error: error ? "Incorrect password." : null };
    },
    [user],
  );

  // Ensures the locally stored session is still valid on the server before we
  // hit /reauthenticate. A stale token (session replaced by a previous OTP
  // sign-in) is what produces "Auth session missing!" / 403 session_not_found.
  const ensureLiveSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;
    const expiresAt = (data.session.expires_at ?? 0) * 1000;
    if (expiresAt - Date.now() < 60_000) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return !!refreshed.session;
    }
    return true;
  }, []);

  // SENDING: never use signInWithOtp here — it issues a magic-link/new session
  // and clobbers the session of the already-logged-in user. reauthenticate()
  // emails a code-only token bound to the CURRENT session.
  const sendResetOtp = useCallback(async () => {
    if (!user?.email) return { error: "No email on this account." };
    if (!(await ensureLiveSession())) {
      return { error: "Your session expired. Please sign in again." };
    }
    let { error } = await supabase.auth.reauthenticate();
    if (error) {
      // One retry after a forced refresh covers a token revoked server-side.
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (!refreshed.session) {
        return { error: "Your session expired. Please sign in again." };
      }
      ({ error } = await supabase.auth.reauthenticate());
    }
    logEvent({ category: "auth", action: "mpin_reset_request", success: !error, failure_reason: error?.message });
    return { error: error ? error.message || "Could not send the code." : null };
  }, [user, ensureLiveSession]);

  // VERIFYING: no supabase.auth.verifyOtp() — that would mint a replacement
  // session. The code is checked server-side against the current user's
  // reauthentication_token, so the existing session is left untouched.
  const verifyResetOtp = useCallback(
    async (code: string) => {
      if (!user?.email) return { error: "No email on this account." };
      const { data, error } = await supabase.rpc("verify_mpin_reset_otp", { _code: code });
      if (error) {
        logEvent({ category: "auth", action: "mpin_reset_failure", success: false, failure_reason: error.message });
        return { error: error.message || "Invalid or expired code." };
      }
      const result = data as MpinResetOtpResult;
      logEvent({
        category: "auth",
        action: result.ok ? "mpin_reset_success" : "mpin_reset_failure",
        success: !!result.ok,
        failure_reason: result.ok ? undefined : result.message,
      });
      return { error: result.ok ? null : result.message || "Invalid or expired code." };
    },
    [user],
  );


  const value = useMemo(
    () => ({
      loading,
      status,
      refresh,
      isUnlocked,
      unlock,
      lockAll,
      verify,
      setMpin,
      reauthenticate,
      sendResetOtp,
      verifyResetOtp,
      email: user?.email ?? null,
    }),
    [
      loading,
      status,
      refresh,
      isUnlocked,
      unlock,
      lockAll,
      verify,
      setMpin,
      reauthenticate,
      sendResetOtp,
      verifyResetOtp,
      user,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMpin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMpin must be used within MpinProvider");
  return ctx;
}
