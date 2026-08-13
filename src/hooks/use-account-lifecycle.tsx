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

export type LifecycleState = "active" | "deactivated" | "pending_deletion" | "deleted";

export type AccountLifecycle = {
  state: LifecycleState;
  deactivated_at: string | null;
  reactivate_at: string | null;
  deactivation_days: number | null;
  deletion_requested_at: string | null;
  delete_after: string | null;
};

type RpcResult = { ok?: boolean; message?: string };

type Ctx = {
  loading: boolean;
  lifecycle: AccountLifecycle | null;
  isDeactivated: boolean;
  isPendingDeletion: boolean;
  daysLeft: number | null;
  refresh: () => Promise<void>;
  deactivate: (mpin: string, days: number | null) => Promise<{ error: string | null }>;
  reactivate: () => Promise<{ error: string | null }>;
  requestDeletion: (mpin: string) => Promise<{ error: string | null }>;
  deleteNow: (mpin: string) => Promise<{ error: string | null }>;
  cancelDeletion: () => Promise<{ error: string | null }>;
};

const LifecycleCtx = createContext<Ctx | null>(null);

const ACTIVE: AccountLifecycle = {
  state: "active",
  deactivated_at: null,
  reactivate_at: null,
  deactivation_days: null,
  deletion_requested_at: null,
  delete_after: null,
};

export function AccountLifecycleProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.id ?? null;

  const [lifecycle, setLifecycle] = useState<AccountLifecycle | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!uid) {
      setLifecycle(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("account_lifecycle")
      .select(
        "state, deactivated_at, reactivate_at, deactivation_days, deletion_requested_at, delete_after",
      )
      .eq("user_id", uid)
      .maybeSingle();
    setLifecycle(error ? ACTIVE : ((data as AccountLifecycle | null) ?? ACTIVE));
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    void refresh();
  }, [authLoading, refresh]);

  const call = useCallback(
    async (fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
      const { data, error } = await fn();
      if (error) return { error: error.message };
      const res = (data ?? {}) as RpcResult;
      if (res.ok === false) return { error: res.message ?? "Something went wrong." };
      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const deactivate = useCallback(
    (mpin: string, days: number | null) =>
      call(() => supabase.rpc("request_deactivation", { _mpin: mpin, _days: days })),
    [call],
  );

  const reactivate = useCallback(() => call(() => supabase.rpc("reactivate_account")), [call]);

  const requestDeletion = useCallback(
    (mpin: string) => call(() => supabase.rpc("request_deletion", { _mpin: mpin })),
    [call],
  );

  const deleteNow = useCallback(async (mpin: string) => {
    const { data, error } = await supabase.functions.invoke("account-delete-now", {
      body: { mpin },
    });
    if (error) return { error: error.message };
    const res = (data ?? {}) as { ok?: boolean; error?: string };
    if (!res.ok) return { error: res.error ?? "Something went wrong." };
    return { error: null };
  }, []);

  const cancelDeletion = useCallback(() => call(() => supabase.rpc("cancel_deletion")), [call]);

  const daysLeft = useMemo(() => {
    const target = lifecycle?.delete_after ?? lifecycle?.reactivate_at;
    if (!target) return null;
    const ms = new Date(target).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  }, [lifecycle]);

  const value = useMemo(
    () => ({
      loading,
      lifecycle,
      isDeactivated: lifecycle?.state === "deactivated",
      isPendingDeletion: lifecycle?.state === "pending_deletion",
      daysLeft,
      refresh,
      deactivate,
      reactivate,
      requestDeletion,
      deleteNow,
      cancelDeletion,
    }),
    [
      loading,
      lifecycle,
      daysLeft,
      refresh,
      deactivate,
      reactivate,
      requestDeletion,
      deleteNow,
      cancelDeletion,
    ],
  );

  return <LifecycleCtx.Provider value={value}>{children}</LifecycleCtx.Provider>;
}

export function useAccountLifecycle() {
  const ctx = useContext(LifecycleCtx);
  if (!ctx) throw new Error("useAccountLifecycle must be used within AccountLifecycleProvider");
  return ctx;
}
