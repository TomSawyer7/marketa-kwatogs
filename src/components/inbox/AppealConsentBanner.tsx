import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Check, X } from "lucide-react";
import { toast } from "sonner";

type AppealRow = {
  id: string;
  seller_id: string;
  buyer_id: string;
  buyer_chat_consent: boolean;
  seller_chat_consent: boolean;
  status: string;
  reason: string;
};

export function AppealConsentBanner({ transactionId }: { transactionId: string | null | undefined }) {
  const { user } = useAuth();
  const [row, setRow] = useState<AppealRow | null>(null);

  const load = useCallback(async () => {
    if (!transactionId || !user) { setRow(null); return; }
    const { data } = await (supabase.from("review_appeals") as any)
      .select("id, seller_id, buyer_id, buyer_chat_consent, seller_chat_consent, status, reason")
      .eq("transaction_id", transactionId)
      .not("status", "in", "(Approved,Rejected,Resolved)")
      .maybeSingle();
    setRow((data as AppealRow) ?? null);
  }, [transactionId, user]);

  useEffect(() => { load(); }, [load]);

  if (!row || !user) return null;
  const isBuyer = user.id === row.buyer_id;
  const isSeller = user.id === row.seller_id;
  if (!isBuyer && !isSeller) return null;

  const myConsent = isBuyer ? row.buyer_chat_consent : row.seller_chat_consent;
  const otherConsent = isBuyer ? row.seller_chat_consent : row.buyer_chat_consent;

  const toggle = async (value: boolean) => {
    const patch = isBuyer ? { buyer_chat_consent: value } : { seller_chat_consent: value };
    const { error } = await (supabase.from("review_appeals") as any).update(patch).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(value ? "Consent granted" : "Consent revoked");
    load();
  };

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 md:px-4 py-2.5 text-sm">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">Review appeal in progress</span>
            <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Admins can only audit this chat if both of you consent. Consent auto-revokes once resolved.
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={myConsent ? "default" : "outline"}>You: {myConsent ? "granted" : "not granted"}</Badge>
            <Badge variant={otherConsent ? "default" : "outline"}>Other party: {otherConsent ? "granted" : "not granted"}</Badge>
          </div>
        </div>
        <div className="shrink-0">
          {myConsent ? (
            <Button size="sm" variant="outline" onClick={() => toggle(false)} className="gap-1">
              <X className="h-3.5 w-3.5" /> Revoke
            </Button>
          ) : (
            <Button size="sm" onClick={() => toggle(true)} className="gap-1">
              <Check className="h-3.5 w-3.5" /> Grant consent
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
