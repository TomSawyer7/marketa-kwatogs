import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ListingCard } from "@/components/marketa/ListingCard";
import { EmptyState } from "@/components/marketa/EmptyState";
import { useMarketa } from "@/store/marketa";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

const Saved = () => {
  const { saved, listings } = useMarketa();
  const items = saved.map((id) => listings.find((l) => l.id === id)).filter(Boolean) as typeof listings;

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Saved items</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {items.length} saved {items.length === 1 ? "listing" : "listings"}
        </p>

        <div className="mt-5">
          {items.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Nothing saved yet"
              description="Tap the bookmark icon on any listing to save it for later."
              action={<Button asChild><Link to="/">Browse listings</Link></Button>}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {items.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default Saved;
