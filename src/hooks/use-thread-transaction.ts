import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TxRow = {
  id: string;
  listing_id: string | null;
  seller_id: string;
  buyer_id: string;
  status: string;
  thread_id: string | null;
  confirmed_at: string | null;
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
  created_at: string;
};

export function useThreadTransaction(threadId: string | undefined) {
  const [tx, setTx] = useState<TxRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;

    const fetchTx = async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) { setTx((data ?? null) as TxRow | null); setLoading(false); }
    };
    fetchTx();

    const ch = supabase
      .channel(`tx:${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `thread_id=eq.${threadId}` },
        () => fetchTx(),
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [threadId]);

  return { tx, loading, refetch: () => setTx((v) => v && { ...v }) };
}
