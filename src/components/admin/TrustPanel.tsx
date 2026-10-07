import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatRelative } from "@/lib/format";
import { RatingStars } from "@/components/reviews/RatingStars";
import { AppealsWorkspace } from "@/components/admin/AppealsWorkspace";

type Report = { id: string; review_id: string; reporter_id: string; reason: string; status: string; created_at: string; admin_note?: string | null;
  reviews?: { id: string; rating: number; comment: string | null; reviewee_id: string } | null };
type Appeal = { id: string; user_id: string; message: string; status: string; created_at: string; admin_note: string | null };
type Status = { user_id: string; status: string; reason: string | null; updated_at: string };
type ReviewAppeal = {
  id: string; review_id: string; transaction_id: string; seller_id: string; buyer_id: string;
  reason: string; evidence_urls: string[] | null;
  buyer_chat_consent: boolean; seller_chat_consent: boolean;
  status: "Pending" | "Waiting for Consent" | "Under Review" | "Waiting for Additional Evidence" | "Approved" | "Rejected" | "Resolved";
  admin_notes: string | null; created_at: string;
  reviews?: { id: string; rating: number; comment: string | null } | null;
};

export function TrustPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [restricted, setRestricted] = useState<Status[]>([]);
  const [reviewAppeals, setReviewAppeals] = useState<ReviewAppeal[]>([]);

  const load = useCallback(async () => {
    const [r, a, s, ra] = await Promise.all([
      supabase.from("review_reports").select("id, review_id, reporter_id, reason, status, created_at, reviews:review_id(id, rating, comment, reviewee_id)").order("created_at", { ascending: false }),
      supabase.from("account_appeals").select("id, user_id, message, status, created_at, admin_note").order("created_at", { ascending: false }),
      supabase.from("account_status").select("user_id, status, reason, updated_at").neq("status", "active").order("updated_at", { ascending: false }),
      (supabase.from("review_appeals") as any).select("id, review_id, transaction_id, seller_id, buyer_id, reason, evidence_urls, buyer_chat_consent, seller_chat_consent, status, admin_notes, created_at, reviews:review_id(id, rating, comment)").order("created_at", { ascending: false }),
    ]);
    setReports((r.data as Report[]) ?? []);
    setAppeals((a.data as Appeal[]) ?? []);
    setRestricted((s.data as Status[]) ?? []);
    setReviewAppeals(((ra as any).data as ReviewAppeal[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolveReviewAppeal = async (id: string, status: ReviewAppeal["status"], note?: string) => {
    const { error } = await (supabase.from("review_appeals") as any)
      .update({ status, admin_notes: note ?? null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Appeal marked ${status}`); load();
  };

  const resolveReport = async (id: string, status: "reviewed" | "resolved" | "needs_follow_up") => {
    const note = prompt("Short admin note (optional):");
    if (note === null) return;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase.from("review_reports") as any)
      .update({ status, admin_note: note.trim().slice(0, 500) || null, resolved_by: auth.user?.id, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Report updated"); load();
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
        <TabsTrigger value="review-appeals">Review appeals ({reviewAppeals.filter(a => !["Approved","Rejected","Resolved"].includes(a.status)).length})</TabsTrigger>
        <TabsTrigger value="appeals">Account appeals ({appeals.filter(a => a.status === "pending").length})</TabsTrigger>
        <TabsTrigger value="restricted">Restricted ({restricted.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="review-appeals" className="mt-3">
        <AppealsWorkspace />
      </TabsContent>



      <TabsContent value="reports" className="mt-3 space-y-2">
        {reports.length === 0 && <div className="text-sm text-muted-foreground py-6">No reports.</div>}
        {reports.map((r) => (
          <div key={r.id} className="bg-card border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2"><Badge variant={r.status === "pending" ? "secondary" : "outline"}>{r.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span></div>
                <p className="text-sm"><span className="text-muted-foreground">Reporter:</span> {r.reporter_id.slice(0, 8)}…</p>
                <p className="text-sm"><span className="text-muted-foreground">Reported user:</span> {r.reviews?.reviewee_id ? `${r.reviews.reviewee_id.slice(0, 8)}…` : "—"}</p>
                <p className="text-sm"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
                {r.admin_note && <p className="text-xs text-muted-foreground">Admin note: {r.admin_note}</p>}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => resolveReport(r.id, "reviewed")}>Reviewed</Button>
                <Button size="sm" onClick={() => resolveReport(r.id, "resolved")}>Resolved</Button>
                <Button size="sm" variant="outline" onClick={() => resolveReport(r.id, "needs_follow_up")}>Needs Follow-up</Button>
              </div>
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
