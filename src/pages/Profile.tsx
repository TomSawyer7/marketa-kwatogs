import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListingCard } from "@/components/marketa/ListingCard";
import { EmptyState } from "@/components/marketa/EmptyState";
import { useMarketa } from "@/store/marketa";
import { UserReviewList, useUserRating } from "@/components/reviews/UserReviewList";
import { RatingsSummary } from "@/components/reviews/RatingsSummary";
import { useSellerTxStats } from "@/hooks/use-seller-tx-stats";
import { Bookmark, MapPin, Plus, Settings, Share2, Star, Store } from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const { profile, myListings, listings, saved, currentUserId } = useMarketa();
  const savedItems = saved.map((id) => listings.find((l) => l.id === id)).filter(Boolean) as typeof listings;
  const rating = useUserRating(currentUserId ?? undefined);
  const { successfulCount } = useSellerTxStats(currentUserId ?? undefined);

  const skillTags = Array.from(new Set(myListings.map((l) => l.category))).slice(0, 4);
  if (skillTags.length === 0) skillTags.push("Verified Seller");

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: profile.name, url });
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
            <AvatarImage src={profile.avatar} alt={profile.name} />
            <AvatarFallback>{profile.name.slice(0, 1)}</AvatarFallback>
          </Avatar>

          <div className="mt-5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{profile.name}</h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{profile.location}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{profile.bio ?? "Verified Seller"}</p>
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
            <Metric value={myListings.length} label="Listings" />
            <Metric value={successfulCount} label="Successful Transactions" />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button asChild className="flex-1 rounded-full h-12 text-base font-medium">
              <Link to="/settings">
                <Settings className="h-4 w-4 mr-2" />
                Edit profile
              </Link>
            </Button>
            <Link
              to="/sell"
              aria-label="Create new listing"
              className="h-12 w-12 grid place-items-center rounded-full bg-card border border-border hover:bg-muted transition"
            >
              <Plus className="h-5 w-5" />
            </Link>
          </div>
        </section>

        {/* Ratings aggregate */}
        {currentUserId && <RatingsSummary userId={currentUserId} userName={profile.name} />}

        {/* Tabs */}
        <Tabs defaultValue="listings">
          <TabsList>
            <TabsTrigger value="listings">Your listings</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({rating.count})</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-4">
            {myListings.length === 0 ? (
              <EmptyState
                icon={Store}
                title="You have no listings yet"
                description="Sell something to clear space and earn cash."
                action={<Button asChild><Link to="/sell"><Plus className="h-4 w-4 mr-1.5" />Create listing</Link></Button>}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                {myListings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved" className="mt-4">
            {savedItems.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title="No saved items"
                description="Listings you save will appear here."
                action={<Button asChild variant="outline"><Link to="/">Browse listings</Link></Button>}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                {savedItems.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="mt-4">
            {currentUserId && <UserReviewList userId={currentUserId} />}
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

export default Profile;
