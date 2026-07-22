import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export type ListingContext = {
  id: string;
  title: string;
  price: number;
  image: string | null;
};

export function ListingContextBar({
  listing,
  txStatus,
}: {
  listing: ListingContext;
  txStatus?: string | null;
}) {
  const status =
    txStatus === "completed"
      ? { label: "Completed", tone: "default" as const }
      : txStatus === "seller_completed"
        ? { label: "Awaiting confirmation", tone: "secondary" as const }
        : txStatus
          ? { label: "In progress", tone: "secondary" as const }
          : { label: "Active", tone: "outline" as const };

  return (
    <Link
      to={`/item/${listing.id}`}
      className="flex items-center gap-3 px-3 md:px-4 py-2 border-b border-border bg-muted/30 hover:bg-muted/50 transition"
    >
      <div className="h-11 w-11 rounded-lg bg-muted overflow-hidden shrink-0">
        {listing.image ? (
          <img src={listing.image} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{listing.title}</div>
        <div className="text-xs text-muted-foreground">
          ₱{Number(listing.price).toLocaleString()}
        </div>
      </div>
      <Badge variant={status.tone} className="rounded-full text-[10px] uppercase">
        {status.label}
      </Badge>
    </Link>
  );
}
