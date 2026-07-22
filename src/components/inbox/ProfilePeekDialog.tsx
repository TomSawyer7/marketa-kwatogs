import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Star, ArrowUpRight } from "lucide-react";
import { formatPrice } from "@/lib/format";

type Profile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  location: string | null;
  created_at: string | null;
};

type MiniListing = {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
};

export function ProfilePeekDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [verified, setVerified] = useState(false);
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [listings, setListings] = useState<MiniListing[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: p }, { data: v }, { data: rs }, { data: ls }] = await Promise.all([
        supabase.from("profiles").select("id, name, avatar_url, location, created_at").eq("id", userId).maybeSingle(),
        supabase.from("verified_users").select("user_id").eq("user_id", userId).maybeSingle(),
        supabase.from("reviews").select("rating").eq("reviewee_id", userId),
        supabase.from("listings").select("id, title, price, images").eq("seller_id", userId).order("created_at", { ascending: false }).limit(6),
      ]);
      if (cancelled) return;
      setProfile(p as Profile | null);
      setVerified(!!v);
      const ratings = (rs ?? []).map((r) => r.rating as number);
      setCount(ratings.length);
      setAvg(ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : null);
      setListings((ls ?? []) as MiniListing[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, userId]);

  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">Profile</DialogTitle>
        </DialogHeader>

        {loading || !profile ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.name ?? ""} />
                <AvatarFallback>{profile.name?.[0] ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold truncate">{profile.name ?? "Unnamed"}</h2>
                  {verified && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <BadgeCheck className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {profile.location ?? "—"}
                  {joined ? ` · Joined ${joined}` : ""}
                </div>
                {avg !== null && (
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                    <span className="font-medium">{avg.toFixed(1)}</span>
                    <span className="text-muted-foreground">({count})</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                Active listings
              </div>
              {listings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active listings.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {listings.map((l) => (
                    <Link
                      key={l.id}
                      to={`/item/${l.id}`}
                      onClick={() => onOpenChange(false)}
                      className="group block rounded-lg overflow-hidden bg-muted"
                    >
                      <div className="aspect-square bg-secondary overflow-hidden">
                        {l.images?.[0] && (
                          <img
                            src={l.images[0]}
                            alt={l.title}
                            loading="lazy"
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          />
                        )}
                      </div>
                      <div className="p-1.5">
                        <div className="text-[11px] font-semibold truncate">{formatPrice(l.price)}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{l.title}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {profile && (
            <Button asChild className="gap-1.5">
              <Link to={`/seller/${profile.id}`} onClick={() => onOpenChange(false)}>
                View full profile <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
