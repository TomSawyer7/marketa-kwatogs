import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
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
import { useInbox } from "@/hooks/use-inbox";
import { getOrCreateThread } from "@/lib/inbox";
import { useEffect } from "react";
import { toast } from "sonner";

type Person = { id: string; name: string | null; avatar_url: string | null; location: string | null };

const Inbox = () => {
  const { user } = useAuth();
  const rows = useInbox();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "unread" | "active">("all");
  const [people, setPeople] = useState<Person[]>([]);

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
        (r) => r.otherName.toLowerCase().includes(term) || r.lastBody.toLowerCase().includes(term),
      );
    }
    return list;
  }, [rows, tab, q]);

  const openWithPerson = async (otherId: string) => {
    if (!user) return;
    try {
      const id = await getOrCreateThread(user.id, otherId);
      navigate(`/inbox/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const showSearch = q.trim().length >= 1;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-5 md:py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats and people…"
            className="pl-9 rounded-full h-11 bg-muted border-transparent focus-visible:bg-card"
          />
        </div>

        {!showSearch && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="active">Active Transactions</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {showSearch ? (
          <div className="space-y-6">
            <section>
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Messages</h2>
              {filtered && filtered.length > 0 ? (
                <ul className="space-y-1">
                  {filtered.map((r) => (
                    <ThreadItem
                      key={r.thread.id}
                      row={r}
                      onClick={() => navigate(`/inbox/${r.thread.id}`)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No conversations match.</p>
              )}
            </section>
            <section>
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">New people</h2>
              {people.length > 0 ? (
                <ul className="space-y-1">
                  {people.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => openWithPerson(p.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition text-left"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={p.avatar_url ?? undefined} alt={p.name ?? ""} />
                          <AvatarFallback>{p.name?.[0] ?? "?"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{p.name ?? "Unnamed"}</div>
                          <div className="text-xs text-muted-foreground truncate">{p.location ?? "—"}</div>
                        </div>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No people found.</p>
              )}
            </section>
          </div>
        ) : rows === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered && filtered.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No conversations yet"
            description="Search for a seller or buyer above to start chatting."
          />
        ) : (
          <ul className="space-y-1">
            {filtered!.map((r) => (
              <ThreadItem key={r.thread.id} row={r} onClick={() => navigate(`/inbox/${r.thread.id}`)} />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
};

function ThreadItem({ row, onClick }: { row: ReturnType<typeof useInbox> extends (infer T)[] | null ? T : never; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition text-left"
      >
        <Avatar className="h-11 w-11">
          <AvatarImage src={row.otherAvatar ?? undefined} alt={row.otherName} />
          <AvatarFallback>{row.otherName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">{row.otherName}</span>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {formatRelative(new Date(row.thread.last_message_at).getTime())}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={`text-sm truncate ${row.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
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
      </button>
    </li>
  );
}

export default Inbox;
