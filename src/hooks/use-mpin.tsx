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

export type MpinSection = "inbox" | "sell" | "settings";

export type MpinStatus = {
  has_mpin: boolean;
  locked: boolean;
  attempts_left: number;
};

export type VerifyResult = MpinStatus & { ok: boolean };

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
        return { ok: false, has_mpin: true, locked: false, attempts_left: 0 };
      }
      const result = data as unknown as VerifyResult;
      setStatus({
        has_mpin: result.has_mpin,
        locked: result.locked,
        attempts_left: result.attempts_left,
      });
      if (result.ok && section) unlock(section);
      return result;
    },
    [unlock],
  );

  const setMpin = useCallback(
    async (mpin: string) => {
      const { error } = await supabase.rpc("set_mpin", { _mpin: mpin });
      if (error) return { error: error.message };
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
    }),
    [loading, status, refresh, isUnlocked, unlock, lockAll, verify, setMpin, reauthenticate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMpin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMpin must be used within MpinProvider");
  return ctx;
}
