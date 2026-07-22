import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useThread } from "@/hooks/use-thread";
import { useThreadTransaction } from "@/hooks/use-thread-transaction";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import { TransactionHub } from "@/components/inbox/TransactionHub";
import { Composer } from "@/components/inbox/Composer";
import { ListingContextBar, type ListingContext } from "@/components/inbox/ListingContextBar";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { useReviewEligibility } from "@/hooks/use-review-eligibility";
import { EmptyState } from "@/components/marketa/EmptyState";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  threadId: string | null;
  onBack?: () => void;
  showBack?: boolean;
};

export function ChatPane({ threadId, onBack, showBack }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const chat = useThread(threadId ?? undefined);
  const { tx } = useThreadTransaction(threadId ?? undefined);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [listing, setListing] = useState<ListingContext | null>(null);
  const [replyTo, setReplyTo] = useState<import("@/lib/inbox").Message | null>(null);
  const [editing, setEditing] = useState<import("@/lib/inbox").Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const eligibility = useReviewEligibility(chat.otherId ?? undefined);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length, chat.typing]);

  useEffect(() => {
    const listingId = chat.thread?.listing_id;
    if (!listingId) { setListing(null); return; }
    let cancelled = false;
    supabase
      .from("listings")
      .select("id, title, price, images")
      .eq("id", listingId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setListing({
          id: data.id,
          title: data.title,
          price: data.price,
          image: data.images?.[0] ?? null,
        });
      });
    return () => { cancelled = true; };
  }, [chat.thread?.listing_id]);

  if (!threadId) {
    return (
      <div className="flex-1 grid place-items-center bg-background">
        <EmptyState
          icon={MessageCircle}
          title="Select a conversation"
          description="Pick a chat from the left to start messaging."
        />
      </div>
    );
  }

  if (chat.loading) {
    return <div className="flex-1 p-6 text-sm text-muted-foreground">Loading chat…</div>;
  }
  if (!chat.thread || !chat.otherId || !chat.otherProfile) {
    return (
      <div className="flex-1 p-6 text-sm">
        Thread not found. <Link className="text-primary underline" to="/inbox">Back to inbox</Link>
      </div>
    );
  }

  const canRate = eligibility.status === "eligible";

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 md:px-4 py-3 border-b border-border bg-card">
        {showBack && (
          <Button variant="ghost" size="icon" onClick={onBack ?? (() => navigate("/inbox"))} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Link to={`/seller/${chat.otherProfile.id}`} className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={chat.otherProfile.avatar_url ?? undefined} alt={chat.otherProfile.name} />
              <AvatarFallback>{chat.otherProfile.name?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${chat.online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{chat.otherProfile.name ?? "Unnamed"}</div>
            <div className="text-[11px] text-muted-foreground">
              {chat.typing ? "typing…" : chat.online ? "Online" : "Offline"}
            </div>
          </div>
        </Link>
      </div>

      {listing && <ListingContextBar listing={listing} txStatus={tx?.status ?? null} />}

      <TransactionHub
        threadId={chat.thread.id}
        otherId={chat.otherId}
        tx={tx}
        canRate={canRate}
        onRate={() => setReviewOpen(true)}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-2 bg-background">
        {chat.messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-16">Say hi 👋</div>
        )}
        {chat.messages.map((m) => {
          const quoted = m.reply_to_message_id
            ? chat.messages.find((x) => x.id === m.reply_to_message_id) ?? null
            : null;
          return (
            <div key={m.id} id={`msg-${m.id}`}>
              <MessageBubble
                m={m}
                mine={m.sender_id === user?.id}
                tx={tx}
                viewerRole={tx && user ? (tx.buyer_id === user.id ? "buyer" : tx.seller_id === user.id ? "seller" : null) : null}
                onConfirmed={() => setReviewOpen(true)}
                quoted={quoted}
                otherName={chat.otherProfile?.name ?? undefined}
                onReply={(msg) => { setEditing(null); setReplyTo(msg); }}
                onEdit={(msg) => { setReplyTo(null); setEditing(msg); }}
                onUnsend={chat.unsendMessage ? (msg) => chat.unsendMessage(msg.id) : undefined}
                onRemoveImage={chat.removeImage ? (msg) => chat.removeImage(msg.id) : undefined}
                onJumpTo={(id) => {
                  const el = document.getElementById(`msg-${id}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              />
            </div>
          );
        })}
        {chat.typing && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground animate-pulse">…</div>
          </div>
        )}
      </div>

      <Composer
        onSendText={chat.send}
        onSendImage={chat.sendImage}
        onEdit={chat.editMessage}
        onTyping={chat.sendTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        otherName={chat.otherProfile?.name ?? undefined}
        meId={user?.id}
      />

      {reviewOpen && eligibility.status === "eligible" && (
        <ReviewForm
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          transactionId={eligibility.transactionId}
          revieweeId={chat.otherId}
          role={eligibility.role}
          revieweeName={chat.otherProfile.name ?? "user"}
          onSubmitted={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}
