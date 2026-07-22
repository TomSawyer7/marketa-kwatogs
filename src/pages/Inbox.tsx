import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/marketa/EmptyState";
import { MessageCircle, Search, UserPlus } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useInbox, type InboxRow } from "@/hooks/use-inbox";
import { getOrCreateThread } from "@/lib/inbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatPane } from "@/components/inbox/ChatPane";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ProfilePeekDialog } from "@/components/inbox/ProfilePeekDialog";

type Person = { id: string; name: string | null; avatar_url: string | null; location: string | null };

const Inbox = () => {
  const { user } = useAuth();
  const rows = useInbox();
  const navigate = useNavigate();
  const { id: activeIdParam } = useParams();
  const isMobile = useIsMobile();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "unread" | "active">("all");
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);

  const activeId = activeIdParam ?? selectedId;

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || !user) { setPeople([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, location")
        .or(`name.ilike.%${term}%,location.ilike.%${term}%`)
        .neq("id", user.id)
        .limit(8);
      setPeople((data ?? []) as Person[]);
    }, 200);
    return () => clearTimeout(t);
  }, [q, user]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = q.trim().toLowerCase();
    let list = rows;
    if (tab === "unread") list = list.filter((r) => r.unread > 0);
    if (tab === "active") list = list.filter((r) => r.hasActiveTx);
    if (term) {
      list = list.filter(
        (r) =>
          r.otherName.toLowerCase().includes(term) ||
          r.lastBody.toLowerCase().includes(term) ||
          (r.listing?.title?.toLowerCase().includes(term) ?? false),
      );
    }
    return list;
  }, [rows, tab, q]);

  const openThread = (threadId: string) => {
    if (isMobile) navigate(`/inbox/${threadId}`);
    else setSelectedId(threadId);
  };

  const openWithPerson = async (otherId: string) => {
    if (!user) return;
    try {
      const id = await getOrCreateThread(user.id, otherId);
      openThread(id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const showSearch = q.trim().length >= 1;

  const sidebar = (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 md:p-5 space-y-3 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats and people…"
            className="pl-9 rounded-full h-10 bg-muted border-transparent focus-visible:bg-card"
          />
        </div>
        {!showSearch && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="unread" className="flex-1">Unread</TabsTrigger>
              <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {showSearch ? (
          <div className="p-3 space-y-4">
            <section>
              <h2 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 px-2">Messages</h2>
              {filtered && filtered.length > 0 ? (
                <ul className="space-y-0.5">
                  {filtered.map((r) => (
                    <ThreadItem
                      key={r.thread.id}
                      row={r}
                      active={r.thread.id === activeId}
                      onClick={() => openThread(r.thread.id)}
                      onPeek={() => setPeekId(r.otherId)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground px-2">No conversations match.</p>
              )}
            </section>
            <section>
              <h2 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 px-2">New people</h2>
              {people.length > 0 ? (
                <ul className="space-y-0.5">
                  {people.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => openWithPerson(p.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition text-left"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={p.avatar_url ?? undefined} alt={p.name ?? ""} />
                          <AvatarFallback>{p.name?.[0] ?? "?"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.name ?? "Unnamed"}</div>
                          <div className="text-xs text-muted-foreground truncate">{p.location ?? "—"}</div>
                        </div>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground px-2">No people found.</p>
              )}
            </section>
          </div>
        ) : rows === null ? (
          <p className="text-sm text-muted-foreground p-4">Loading…</p>
        ) : filtered && filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={MessageCircle}
              title="No conversations yet"
              description="Search for a seller or buyer above to start chatting."
            />
          </div>
        ) : (
          <ul className="p-2 space-y-0.5">
            {filtered!.map((r) => (
              <ThreadItem
                key={r.thread.id}
                row={r}
                active={r.thread.id === activeId}
                onClick={() => openThread(r.thread.id)}
                onPeek={() => setPeekId(r.otherId)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <AppShell>
        {sidebar}
        <ProfilePeekDialog open={!!peekId} onOpenChange={(v) => !v && setPeekId(null)} userId={peekId} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="grid grid-cols-[340px_1fr] h-[calc(100dvh-var(--header-h)-1px)] border-t border-border">
        <aside className="border-r border-border bg-card min-h-0">{sidebar}</aside>
        <section className="flex flex-col min-w-0 min-h-0">
          <ChatPane threadId={activeId ?? null} />
        </section>
      </div>
      <ProfilePeekDialog open={!!peekId} onOpenChange={(v) => !v && setPeekId(null)} userId={peekId} />
    </AppShell>
  );
};

function ThreadItem({ row, onClick, active, onPeek }: { row: InboxRow; onClick: () => void; active?: boolean; onPeek?: () => void }) {
  return (
    <li>
      <div
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left cursor-pointer",
          active ? "bg-muted" : "hover:bg-muted/60",
        )}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPeek?.(); }}
          className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={`View ${row.otherName}'s profile`}
        >
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={row.otherAvatar ?? undefined} alt={row.otherName} />
            <AvatarFallback>{row.otherName[0]}</AvatarFallback>
          </Avatar>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate text-sm">{row.otherName}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatRelative(new Date(row.thread.last_message_at).getTime())}
            </span>
          </div>
          {row.listing && (
            <div className="text-[11px] text-muted-foreground truncate">
              re: {row.listing.title}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={`text-xs truncate ${row.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {row.lastFromMe ? "You: " : ""}{row.lastBody}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {row.hasActiveTx && <Badge variant="outline" className="text-[9px] uppercase">Tx</Badge>}
              {row.unread > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 px-1.5 grid place-items-center">
                  {row.unread}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export default Inbox;
