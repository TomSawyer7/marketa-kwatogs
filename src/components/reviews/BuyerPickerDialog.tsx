import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type ProfileRow = { id: string; name: string | null; email: string | null; avatar_url: string | null };

export function BuyerPickerDialog({
  open, onOpenChange, listingId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listingId: string;
  onCreated?: () => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [selected, setSelected] = useState<ProfileRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) { setRows([]); return; }
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url")
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(8);
      if (!cancelled) setRows((data as ProfileRow[]) ?? []);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setBusy(false); return; }
    if (selected.id === auth.user.id) {
      toast.error("You can't sell to yourself");
      setBusy(false); return;
    }
    const { error } = await supabase.from("transactions").insert({
      listing_id: listingId, seller_id: auth.user.id, buyer_id: selected.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as sold — waiting for buyer confirmation");
    onOpenChange(false);
    setSelected(null); setQ(""); setRows([]);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as sold</DialogTitle>
          <DialogDescription>Pick the buyer. They'll confirm the purchase before either of you can leave a review.</DialogDescription>
        </DialogHeader>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email"
          autoFocus
        />

        <ul className="max-h-72 overflow-y-auto divide-y divide-border rounded-md border border-border">
          {rows.length === 0 && (
            <li className="px-3 py-6 text-sm text-muted-foreground text-center">
              {q.trim().length < 2 ? "Type at least 2 characters to search" : "No matches"}
            </li>
          )}
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted ${selected?.id === r.id ? "bg-primary-soft" : ""}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={r.avatar_url ?? undefined} />
                  <AvatarFallback>{(r.name ?? r.email ?? "?").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.name ?? "Unnamed"}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={!selected || busy}>{busy ? "Saving…" : "Confirm sale"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
