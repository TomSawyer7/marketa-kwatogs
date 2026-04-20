import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useMarketa } from "@/store/marketa";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bookmark, MapPin, MessageCircle, Share2, ShieldCheck, Pencil, Trash2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPrice, formatRelative } from "@/lib/format";
import { CATEGORIES } from "@/lib/categories";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const ItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getListing, getSeller, isSaved, toggleSave, deleteListing, currentUserId } = useMarketa();
  const [imgIndex, setImgIndex] = useState(0);
  const [message, setMessage] = useState("");

  const listing = id ? getListing(id) : undefined;

  if (!listing) {
    return (
      <AppShell>
        <div className="px-6 py-16 text-center">
          <h2 className="text-xl font-semibold">Listing not found</h2>
          <Button asChild className="mt-4"><Link to="/">Back to Marketplace</Link></Button>
        </div>
      </AppShell>
    );
  }

  const seller = getSeller(listing.sellerId);
  const saved = isSaved(listing.id);
  const isMine = !!currentUserId && listing.sellerId === currentUserId;
  const category = CATEGORIES.find((c) => c.slug === listing.category);

  const onSendMessage = () => {
    if (!message.trim()) return;
    toast.success("Message sent", { description: "(Demo only — no real messaging.)" });
    setMessage("");
  };

  const onDelete = async () => {
    await deleteListing(listing.id);
    toast.success("Listing deleted");
    navigate("/profile");
  };

  const next = () => setImgIndex((i) => (i + 1) % listing.images.length);
  const prev = () => setImgIndex((i) => (i - 1 + listing.images.length) % listing.images.length);

  return (
    <AppShell>
      <div className="px-3 md:px-6 lg:px-8 py-4 md:py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] gap-5 lg:gap-7">
          {/* Gallery */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="relative aspect-[4/3] bg-secondary">
              <img
                src={listing.images[imgIndex]}
                alt={listing.title}
                className="h-full w-full object-contain bg-black/5"
              />
              {listing.images.length > 1 && (
                <>
                  <button
                    onClick={prev} aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-card/90 grid place-items-center hover:bg-card transition shadow-md"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={next} aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-card/90 grid place-items-center hover:bg-card transition shadow-md"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            {listing.images.length > 1 && (
              <div className="p-3 flex gap-2 overflow-x-auto scrollbar-thin">
                {listing.images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIndex(i)}
                    className={cn(
                      "h-16 w-16 shrink-0 rounded-md overflow-hidden border-2 transition",
                      i === imgIndex ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    <img src={src} alt={`${listing.title} ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details panel */}
          <aside className="space-y-5">
            <div className="bg-card border border-border rounded-lg p-5">
              <h1 className="text-xl md:text-2xl font-bold leading-tight">{listing.title}</h1>
              <div className="text-2xl md:text-3xl font-bold mt-2">{formatPrice(listing.price)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Listed {formatRelative(listing.createdAt)} in {listing.location}
              </div>

              <div className="mt-4 flex gap-2">
                <Button onClick={() => toggleSave(listing.id)} variant={saved ? "default" : "outline"} className="flex-1 gap-2">
                  <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
                  {saved ? "Saved" : "Save"}
                </Button>
                <Button
                  variant="outline" size="icon" aria-label="Share"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    toast.success("Link copied to clipboard");
                  }}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>

              {isMine ? (
                <div className="mt-3 flex gap-2">
                  <Button asChild variant="outline" className="flex-1 gap-2">
                    <Link to={`/sell?edit=${listing.id}`}><Pencil className="h-4 w-4" />Edit</Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="flex-1 gap-2 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Condition</div>
                  <div className="font-medium">{listing.condition}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Category</div>
                  <div className="font-medium">{category?.name ?? listing.category}</div>
                </div>
              </div>

              <div className="mt-5">
                <h3 className="font-semibold text-sm mb-1.5">Description</h3>
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{listing.description}</p>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {listing.location}
              </div>
            </div>

            {/* Seller card */}
            {seller && (
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="font-semibold mb-3">Seller information</h3>
                <Link to={isMine ? "/profile" : `/seller/${seller.id}`} className="flex items-center gap-3 hover:opacity-80 transition">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={seller.avatar} alt={seller.name} />
                    <AvatarFallback>{seller.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{seller.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(seller.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                    </div>
                  </div>
                </Link>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-success">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verified seller · {seller.rating?.toFixed(1) ?? "5.0"} ★</span>
                </div>
              </div>
            )}

            {/* Message form */}
            {!isMine && (
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="font-semibold mb-3">Send seller a message</h3>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Hi! Is "${listing.title}" still available?`}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
                <Button onClick={onSendMessage} className="w-full mt-2 gap-2">
                  <MessageCircle className="h-4 w-4" />Send message
                </Button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
};

export default ItemDetail;
