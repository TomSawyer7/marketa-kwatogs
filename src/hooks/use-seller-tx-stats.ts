import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSellerTxStats(sellerId: string | undefined) {
  const [successfulCount, setSuccessfulCount] = useState<number>(0);

  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerId)
        .eq("status", "completed");
      if (cancelled) return;
      setSuccessfulCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [sellerId]);

  return { successfulCount };
}
