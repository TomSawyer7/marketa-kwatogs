import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useMarketa } from "@/store/marketa";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListingCard } from "@/components/marketa/ListingCard";
import { EmptyState } from "@/components/marketa/EmptyState";
import { UserReviewList, useUserRating } from "@/components/reviews/UserReviewList";
import { RatingsSummary } from "@/components/reviews/RatingsSummary";
import { useSellerTxStats } from "@/hooks/use-seller-tx-stats";
import { useAuth } from "@/hooks/use-auth";
import { getOrCreateThread } from "@/lib/inbox";
import { Bookmark, MapPin, MessageCircle, Share2, Star, Store } from "lucide-react";
import { toast } from "sonner";

const SellerPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getSeller, listings, isSaved, toggleSave } = useMarketa();
  const seller = id ? getSeller(id) : undefined;
  const rating = useUserRating(seller?.id);
  const { successfulCount } = useSellerTxStats(seller?.id);
  const [bookmarked, setBookmarked] = useState(false);
  const [starting, setStarting] = useState(false);

  const startChat = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!seller) return;
    if (user.id === seller.id) { toast.info("That's you."); return; }
    setStarting(true);
    try {
      const tid = await getOrCreateThread(user.id, seller.id);
      navigate(`/inbox/${tid}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setStarting(false); }
  };

  if (!seller) {
    return (
      <AppShell>
        <div className="px-6 py-16 text-center">
          <h2 className="text-xl font-semibold">Seller not found</h2>
          <Button asChild className="mt-4"><Link to="/">Back to Marketplace</Link></Button>
        </div>
      </AppShell>
    );
  }

  const sellerListings = listings.filter((l) => l.sellerId === seller.id);
  const skillTags = Array.from(new Set(sellerListings.map((l) => l.category))).slice(0, 4);
  if (skillTags.length === 0) skillTags.push("Verified Seller");

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: seller.name, url });
      else { await navigator.clipboard.writeText(url); toast.success("Profile link copied"); }
    } catch { /* cancelled */ }
  };

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6 max-w-3xl mx-auto space-y-5">
        {/* Profile header card */}
        <section className="relative rounded-3xl border border-border overflow-hidden bg-gradient-to-br from-primary-soft/60 via-card to-card p-6 md:p-7">
          <button
            onClick={share}
            aria-label="Share profile"
            className="absolute top-4 right-4 h-9 w-9 grid place-items-center rounded-full bg-card/80 backdrop-blur border border-border hover:bg-card transition"
          >
            <Share2 className="h-4 w-4" />
          </button>

          <Avatar className="h-16 w-16 md:h-20 md:w-20 ring-2 ring-background shadow-sm">
            <AvatarImage src={seller.avatar} alt={seller.name} />
            <AvatarFallback>{seller.name.slice(0, 1)}</AvatarFallback>
          </Avatar>

          <div className="mt-5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{seller.name}</h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{seller.location}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{seller.bio ?? "Verified Seller"}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {skillTags.map((t) => (
              <span key={t} className="text-xs px-3 py-1 rounded-full bg-background/70 border border-border text-foreground/80">
                {t}
              </span>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <Metric
              value={
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  {rating.avg != null ? rating.avg.toFixed(1) : "—"}
                </span>
              }
              label="Rating"
            />
            <Metric value={sellerListings.length} label="Listings" />
            <Metric value={successfulCount} label="Successful Transactions" />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button
              className="flex-1 rounded-full h-12 text-base font-medium"
              onClick={startChat}
              disabled={starting}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {starting ? "Opening…" : "Get in touch"}
            </Button>
            <button
              onClick={() => { setBookmarked((v) => !v); }}
              aria-label="Bookmark seller"
              className="h-12 w-12 grid place-items-center rounded-full bg-card border border-border hover:bg-muted transition"
            >
              <Bookmark className={`h-5 w-5 ${bookmarked ? "fill-foreground text-foreground" : "text-foreground"}`} />
            </button>
          </div>
        </section>

        {/* Ratings aggregate (always visible) */}
        <RatingsSummary userId={seller.id} userName={seller.name} />

        {/* Tabs: listings / reviews */}
        <Tabs defaultValue="reviews">
          <TabsList>
            <TabsTrigger value="reviews">Reviews ({rating.count})</TabsTrigger>
            <TabsTrigger value="listings">Listings ({sellerListings.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="reviews" className="mt-3">
            <UserReviewList userId={seller.id} />
          </TabsContent>
          <TabsContent value="listings" className="mt-3">
            {sellerListings.length === 0 ? (
              <EmptyState icon={Store} title="No active listings" description="This seller has nothing for sale right now." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                {sellerListings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

function Metric({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="text-center">
      <div className="text-lg md:text-xl font-bold leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1.5 leading-tight">{label}</div>
    </div>
  );
}

export default SellerPage;
