import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

type Listing = { id: string; title: string; price: number; seller_id: string };

const peso = (n: number) => `₱${Number(n).toLocaleString("en-PH")}`;

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
  const [threadListingId, setThreadListingId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setText(""); setSelectedId(null); setPrice("");
    (async () => {
      const [{ data }, { data: t }] = await Promise.all([
        supabase
          .from("listings")
          .select("id, title, price, seller_id")
          .in("seller_id", [user.id, otherId])
          .order("created_at", { ascending: false }),
        supabase.from("threads").select("listing_id").eq("id", threadId).maybeSingle(),
      ]);
      setListings((data ?? []) as Listing[]);
      setThreadListingId((t as { listing_id: string | null } | null)?.listing_id ?? null);
    })();
  }, [open, user, otherId, threadId]);

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    return listings.filter((l) => !q || l.title.toLowerCase().includes(q)).slice(0, 6);
  }, [listings, text]);

  const pick = (l: Listing) => {
    setText(l.title);
    setSelectedId(l.id);
    setPrice(String(l.price));
    setFocused(false);
  };

  const submit = async () => {
    const title = text.trim();
    if (!user || !title) { toast.error("Enter a proposal title"); return; }
    const listing =
      listings.find((l) => l.id === selectedId) ??
      listings.find((l) => l.title.toLowerCase() === title.toLowerCase()) ??
      listings.find((l) => l.id === threadListingId) ??
      listings.find((l) => l.seller_id === otherId) ??
      listings[0];
    if (!listing) { toast.error("No listing available to link this proposal to"); return; }
    const amount = price.trim() ? Number(price) : listing.price;
    if (Number.isNaN(amount) || amount < 0) { toast.error("Enter a valid amount"); return; }

    setSubmitting(true);
    const buyer_id = listing.seller_id === user.id ? otherId : user.id;
    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({
        listing_id: listing.id,
        buyer_id,
        seller_id: listing.seller_id,
        status: "proposed",
        thread_id: threadId,
      })
      .select("id")
      .single();
    if (error || !tx) { setSubmitting(false); toast.error(error?.message ?? "Failed"); return; }

    await supabase.from("messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      body: `Proposal: ${title} — ${peso(amount)}`,
      kind: "text",
      meta: { transaction_id: tx.id, custom_title: title, amount },
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
          <div className="relative">
            <Label htmlFor="proposal-title">Listing</Label>
            <Input
              id="proposal-title"
              value={text}
              maxLength={120}
              autoComplete="off"
              placeholder="Type a title or pick a listing"
              onChange={(e) => { setText(e.target.value); setSelectedId(null); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
            />
            {focused && suggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-56 overflow-auto">
                {suggestions.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(l)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {l.seller_id === user?.id ? "Yours: " : "Theirs: "}{l.title} — {peso(l.price)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="proposal-price">Amount (₱)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
              <Input
                id="proposal-price"
                type="number"
                min={0}
                inputMode="decimal"
                className="pl-7"
                placeholder="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A transaction record is created and linked to this chat. Both parties then confirm completion.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !text.trim()}>
            {submitting ? "Sending…" : "Send proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
