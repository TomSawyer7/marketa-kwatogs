import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatRelative } from "@/lib/format";
import { RatingStars } from "@/components/reviews/RatingStars";

type Report = { id: string; review_id: string; reporter_id: string; reason: string; status: string; created_at: string;
  reviews?: { id: string; rating: number; comment: string | null; reviewee_id: string } | null };
type Appeal = { id: string; user_id: string; message: string; status: string; created_at: string; admin_note: string | null };
type Status = { user_id: string; status: string; reason: string | null; updated_at: string };

export function TrustPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [restricted, setRestricted] = useState<Status[]>([]);

  const load = useCallback(async () => {
    const [r, a, s] = await Promise.all([
      supabase.from("review_reports").select("id, review_id, reporter_id, reason, status, created_at, reviews:review_id(id, rating, comment, reviewee_id)").order("created_at", { ascending: false }),
      supabase.from("account_appeals").select("id, user_id, message, status, created_at, admin_note").order("created_at", { ascending: false }),
      supabase.from("account_status").select("user_id, status, reason, updated_at").neq("status", "active").order("updated_at", { ascending: false }),
    ]);
    setReports((r.data as Report[]) ?? []);
    setAppeals((a.data as Appeal[]) ?? []);
    setRestricted((s.data as Status[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolveReport = async (id: string, status: "upheld" | "dismissed") => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("review_reports")
      .update({ status, resolved_by: auth.user?.id, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Report ${status}`); load();
  };

  const resolveAppeal = async (id: string, userId: string, status: "approved" | "denied", note?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("account_appeals")
      .update({ status, admin_note: note ?? null, resolved_by: auth.user?.id, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    if (status === "approved") {
      await supabase.from("account_status").upsert({ user_id: userId, status: "active", reason: "admin:appeal_approved", updated_by: auth.user?.id });
    }
    toast.success(`Appeal ${status}`); load();
  };

  const setStatus = async (userId: string, status: "active" | "restricted" | "suspended") => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("account_status").upsert({
      user_id: userId, status, reason: `admin:manual`, updated_by: auth.user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Status updated"); load();
  };

  return (
    <Tabs defaultValue="reports">
      <TabsList>
        <TabsTrigger value="reports">Reports ({reports.filter(r => r.status === "pending").length})</TabsTrigger>
        <TabsTrigger value="appeals">Appeals ({appeals.filter(a => a.status === "pending").length})</TabsTrigger>
        <TabsTrigger value="restricted">Restricted ({restricted.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="reports" className="mt-3 space-y-2">
        {reports.length === 0 && <div className="text-sm text-muted-foreground py-6">No reports.</div>}
        {reports.map((r) => (
          <div key={r.id} className="bg-card border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><Badge variant={r.status === "pending" ? "secondary" : "outline"}>{r.status}</Badge>
                  <span className="text-xs text-muted-foreground">{formatRelative(new Date(r.created_at).getTime())}</span></div>
                <p className="text-sm mt-2"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
                {r.reviews && <div className="mt-2 p-2 rounded border bg-muted/40">
                  <RatingStars value={r.reviews.rating} />
                  <p className="text-sm mt-1">{r.reviews.comment ?? <em className="text-muted-foreground">no comment</em>}</p>
                </div>}
              </div>
              {r.status === "pending" && (
                <div className="flex flex-col gap-2 shrink-0">
                  <Button size="sm" onClick={() => resolveReport(r.id, "upheld")}>Uphold</Button>
                  <Button size="sm" variant="outline" onClick={() => resolveReport(r.id, "dismissed")}>Dismiss</Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="appeals" className="mt-3 space-y-2">
        {appeals.length === 0 && <div className="text-sm text-muted-foreground py-6">No appeals.</div>}
        {appeals.map((a) => (
          <div key={a.id} className="bg-card border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><Badge variant={a.status === "pending" ? "secondary" : "outline"}>{a.status}</Badge>
                  <span className="text-xs text-muted-foreground">User {a.user_id.slice(0, 8)}… · {formatRelative(new Date(a.created_at).getTime())}</span></div>
                <p className="text-sm mt-2 whitespace-pre-line">{a.message}</p>
                {a.admin_note && <p className="text-xs text-muted-foreground mt-2">Admin note: {a.admin_note}</p>}
              </div>
              {a.status === "pending" && (
                <div className="flex flex-col gap-2 shrink-0">
                  <Button size="sm" onClick={() => {
                    const note = prompt("Optional note for the user:") ?? undefined;
                    resolveAppeal(a.id, a.user_id, "approved", note);
                  }}>Approve & lift</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const note = prompt("Reason for denial:") ?? undefined;
                    resolveAppeal(a.id, a.user_id, "denied", note);
                  }}>Deny</Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="restricted" className="mt-3 space-y-2">
        {restricted.length === 0 && <div className="text-sm text-muted-foreground py-6">No restricted or suspended users.</div>}
        {restricted.map((s) => (
          <div key={s.user_id} className="bg-card border rounded-lg p-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={s.status === "suspended" ? "destructive" : "secondary"}>{s.status}</Badge>
                <span className="text-xs text-muted-foreground">{s.user_id.slice(0, 8)}… · {formatRelative(new Date(s.updated_at).getTime())}</span>
              </div>
              {s.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {s.reason}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setStatus(s.user_id, "active")}>Reinstate</Button>
              {s.status !== "suspended" && (
                <Button size="sm" variant="destructive" onClick={() => setStatus(s.user_id, "suspended")}>Suspend</Button>
              )}
            </div>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}
