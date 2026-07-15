import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useThread } from "@/hooks/use-thread";
import { useThreadTransaction } from "@/hooks/use-thread-transaction";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import { TransactionHub } from "@/components/inbox/TransactionHub";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { useReviewEligibility } from "@/hooks/use-review-eligibility";
import { toast } from "sonner";

const ChatThread = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const chat = useThread(id);
  const { tx } = useThreadTransaction(id);
  const [text, setText] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const eligibility = useReviewEligibility(chat.otherId ?? undefined);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages.length, chat.typing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    try { await chat.send(body); } catch (err) { toast.error((err as Error).message); }
  };

  if (chat.loading) {
    return <AppShell><div className="p-6 text-sm text-muted-foreground">Loading chat…</div></AppShell>;
  }
  if (!chat.thread || !chat.otherId || !chat.otherProfile) {
    return <AppShell><div className="p-6 text-sm">Thread not found. <Link className="text-primary underline" to="/inbox">Back to inbox</Link></div></AppShell>;
  }

  const canRate = eligibility.status === "eligible";

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-var(--header-h)-1px)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-3 md:px-4 py-3 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => navigate("/inbox")} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
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

        {/* Transaction hub */}
        <TransactionHub
          threadId={chat.thread.id}
          otherId={chat.otherId}
          tx={tx}
          canRate={canRate}
          onRate={() => setReviewOpen(true)}
        />

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-2 bg-background">
          {chat.messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-16">Say hi 👋</div>
          )}
          {chat.messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              mine={m.sender_id === user?.id}
              tx={tx}
              viewerRole={tx && user ? (tx.buyer_id === user.id ? "buyer" : tx.seller_id === user.id ? "seller" : null) : null}
              onConfirmed={() => setReviewOpen(true)}
            />
          ))}
          {chat.typing && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground animate-pulse">…</div>
            </div>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={submit} className="border-t border-border bg-card px-3 md:px-4 py-3 flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => { setText(e.target.value); chat.sendTyping(); }}
            placeholder="Type a message…"
            className="rounded-full h-11 bg-muted border-transparent focus-visible:bg-card"
            autoComplete="off"
          />
          <Button type="submit" size="icon" className="rounded-full h-11 w-11 shrink-0" disabled={!text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

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
    </AppShell>
  );
};

export default ChatThread;
