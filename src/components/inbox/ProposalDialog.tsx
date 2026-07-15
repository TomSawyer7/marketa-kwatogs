import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

type Listing = { id: string; title: string; price: number; seller_id: string };

export function ProposalDialog({
  open, onOpenChange, threadId, otherId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  threadId: string;
  otherId: string;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      // My listings first (as seller), then other user's listings (as buyer).
      const { data } = await supabase
        .from("listings")
        .select("id, title, price, seller_id")
        .in("seller_id", [user.id, otherId])
        .order("created_at", { ascending: false });
      setListings((data ?? []) as Listing[]);
    })();
  }, [open, user, otherId]);

  const submit = async () => {
    if (!user || !selected) { toast.error("Pick a listing"); return; }
    const listing = listings.find((l) => l.id === selected);
    if (!listing) return;
    setSubmitting(true);
    const buyer_id = listing.seller_id === user.id ? otherId : user.id;
    const seller_id = listing.seller_id;
    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({
        listing_id: listing.id,
        buyer_id,
        seller_id,
        status: "proposed",
        thread_id: threadId,
      })
      .select("id")
      .single();
    if (error || !tx) { setSubmitting(false); toast.error(error?.message ?? "Failed"); return; }

    await supabase.from("messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      body: `Proposal: ${listing.title} — $${listing.price}`,
      kind: "text",
      meta: { transaction_id: tx.id },
    });
    setSubmitting(false);
    onOpenChange(false);
    onCreated();
    toast.success("Proposal sent");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a proposal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Listing</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder="Pick a listing" /></SelectTrigger>
              <SelectContent>
                {listings.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.seller_id === user?.id ? "Yours: " : "Theirs: "}{l.title} — ${l.price}
                  </SelectItem>
                ))}
                {listings.length === 0 && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">No listings available</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            A transaction record is created and linked to this chat. Both parties then confirm completion.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !selected}>
            {submitting ? "Sending…" : "Send proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
