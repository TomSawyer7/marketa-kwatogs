import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useMarketa } from "@/store/marketa";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListingCard } from "@/components/marketa/ListingCard";
import { EmptyState } from "@/components/marketa/EmptyState";
import { UserReviewList, useUserRating } from "@/components/reviews/UserReviewList";
import { RatingsSummary } from "@/components/reviews/RatingsSummary";
import { Calendar, MapPin, ShieldCheck, Store } from "lucide-react";

const SellerPage = () => {
  const { id } = useParams();
  const { getSeller, listings } = useMarketa();
  const seller = id ? getSeller(id) : undefined;
  const rating = useUserRating(seller?.id);

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

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="h-28 md:h-36 bg-gradient-to-br from-primary to-primary-hover" />
          <div className="px-5 md:px-6 pb-5 -mt-10 md:-mt-12 flex flex-col md:flex-row md:items-end gap-4">
            <Avatar className="h-20 w-20 md:h-24 md:w-24 ring-4 ring-card">
              <AvatarImage src={seller.avatar} alt={seller.name} />
              <AvatarFallback>{seller.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 md:pb-1">
              <h2 className="text-2xl font-bold tracking-tight">{seller.name}</h2>
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{seller.location}</span>
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Joined {new Date(seller.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
                <span className="inline-flex items-center gap-1 text-success"><ShieldCheck className="h-3.5 w-3.5" />Verified · {rating.avg != null ? `${rating.avg.toFixed(1)} ★ (${rating.count})` : "No reviews yet"}</span>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="listings" className="mt-6">
          <TabsList>
            <TabsTrigger value="listings">Listings ({sellerListings.length})</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({rating.count})</TabsTrigger>
          </TabsList>
          <TabsContent value="listings" className="mt-3">
            {sellerListings.length === 0 ? (
              <EmptyState icon={Store} title="No active listings" description="This seller has nothing for sale right now." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {sellerListings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            )}
          </TabsContent>
          <TabsContent value="reviews" className="mt-3 space-y-4">
            <RatingsSummary userId={seller.id} userName={seller.name} />
            <UserReviewList userId={seller.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default SellerPage;
