import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type AccountStatus = "active" | "restricted" | "suspended";

type Ctx = {
  status: AccountStatus;
  reason: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AccountStatusCtx = createContext<Ctx | null>(null);

export function AccountStatusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<AccountStatus>("active");
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus("active");
      setReason(null);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("account_status")
      .select("status, reason")
      .eq("user_id", user.id)
      .maybeSingle();
    setStatus((data?.status as AccountStatus) ?? "active");
    setReason(data?.reason ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <AccountStatusCtx.Provider value={{ status, reason, loading, refresh }}>
      {children}
    </AccountStatusCtx.Provider>
  );
}

export function useAccountStatus() {
  const ctx = useContext(AccountStatusCtx);
  if (!ctx) throw new Error("useAccountStatus must be used within AccountStatusProvider");
  return ctx;
}
