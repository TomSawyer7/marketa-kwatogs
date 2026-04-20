import { Link } from "react-router-dom";
import { Bookmark, MapPin } from "lucide-react";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { useMarketa } from "@/store/marketa";
import { cn } from "@/lib/utils";

export function ListingCard({ listing }: { listing: Listing }) {
  const { isSaved, toggleSave } = useMarketa();
  const saved = isSaved(listing.id);

  return (
    <Link to={`/item/${listing.id}`} className="marketa-card group block animate-fade-in">
      <div className="relative aspect-square bg-secondary overflow-hidden">
        <img
          src={listing.images[0]}
          alt={listing.title}
          loading="lazy"
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); toggleSave(listing.id); }}
          aria-label={saved ? "Remove from saved" : "Save listing"}
          className={cn(
            "absolute top-2 right-2 h-9 w-9 grid place-items-center rounded-full backdrop-blur transition",
            saved
              ? "bg-primary text-primary-foreground"
              : "bg-card/80 text-foreground hover:bg-card",
          )}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
        </button>
      </div>
      <div className="p-3">
        <div className="font-bold text-base">{formatPrice(listing.price)}</div>
        <div className="text-sm text-foreground line-clamp-2 mt-0.5">{listing.title}</div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{listing.location}</span>
        </div>
      </div>
    </Link>
  );
}
