import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListingCard } from "@/components/marketa/ListingCard";
import { EmptyState } from "@/components/marketa/EmptyState";
import { useMarketa } from "@/store/marketa";
import { UserReviewList, useUserRating } from "@/components/reviews/UserReviewList";
import { Plus, Settings, MapPin, Calendar, ShieldCheck, Bookmark, Store, MessageSquare, Receipt } from "lucide-react";

const Profile = () => {
  const { profile, myListings, listings, saved, getSeller, currentUserId } = useMarketa();
  const me = currentUserId ? getSeller(currentUserId) : getSeller("u_me");
  const savedItems = saved.map((id) => listings.find((l) => l.id === id)).filter(Boolean) as typeof listings;
  const rating = useUserRating(currentUserId ?? undefined);

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6">
        {/* Cover + identity */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="h-32 md:h-44 bg-gradient-to-br from-primary to-primary-hover" />
          <div className="px-5 md:px-6 pb-5 -mt-12 md:-mt-14 flex flex-col md:flex-row md:items-end gap-4">
            <Avatar className="h-24 w-24 md:h-28 md:w-28 ring-4 ring-card">
              <AvatarImage src={profile.avatar} alt={profile.name} />
              <AvatarFallback>{profile.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 md:pb-1">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{profile.name}</h2>
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.location}</span>
                <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Joined {new Date(me?.joinedAt ?? Date.now()).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
                <span className="inline-flex items-center gap-1 text-success"><ShieldCheck className="h-3.5 w-3.5" />Verified · {rating.avg != null ? `${rating.avg.toFixed(1)} ★ (${rating.count})` : "No reviews yet"}</span>
              </div>
              {profile.bio && <p className="text-sm mt-2 max-w-2xl">{profile.bio}</p>}
            </div>
            <div className="flex flex-wrap gap-2 md:pb-1">
              <Button asChild variant="default" className="gap-1.5"><Link to="/sell"><Plus className="h-4 w-4" />New listing</Link></Button>
              <Button asChild variant="outline" className="gap-1.5"><Link to="/transactions"><Receipt className="h-4 w-4" />Transactions</Link></Button>
              <Button asChild variant="outline" className="gap-1.5"><Link to="/settings"><Settings className="h-4 w-4" />Edit profile</Link></Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Active listings", value: myListings.length, icon: Store },
            { label: "Saved items", value: savedItems.length, icon: Bookmark },
            { label: `Rating (${rating.count})`, value: rating.avg != null ? `${rating.avg.toFixed(1)} ★` : "—", icon: ShieldCheck },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-soft text-primary grid place-items-center"><s.icon className="h-5 w-5" /></div>
              <div>
                <div className="text-lg font-bold leading-none">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="listings" className="mt-6">
          <TabsList>
            <TabsTrigger value="listings">Your listings</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {savedItems.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default Profile;
