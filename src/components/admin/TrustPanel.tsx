import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatRelative } from "@/lib/format";
import { RatingStars } from "@/components/reviews/RatingStars";
import { ShieldAlert, Eye } from "lucide-react";
import { AppealChatViewer } from "@/components/admin/AppealChatViewer";

type Report = { id: string; review_id: string; reporter_id: string; reason: string; status: string; created_at: string;
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
  const [viewerAppeal, setViewerAppeal] = useState<ReviewAppeal | null>(null);

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
        <TabsTrigger value="review-appeals">Review appeals ({reviewAppeals.filter(a => !["Approved","Rejected","Resolved"].includes(a.status)).length})</TabsTrigger>
        <TabsTrigger value="appeals">Account appeals ({appeals.filter(a => a.status === "pending").length})</TabsTrigger>
        <TabsTrigger value="restricted">Restricted ({restricted.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="review-appeals" className="mt-3 space-y-2">
        {reviewAppeals.length === 0 && <div className="text-sm text-muted-foreground py-6">No review appeals.</div>}
        {reviewAppeals.map((a) => {
          const consented = a.buyer_chat_consent && a.seller_chat_consent;
          const active = !["Approved","Rejected","Resolved"].includes(a.status);
          return (
            <div key={a.id} className="bg-card border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="gap-1"><ShieldAlert className="h-3 w-3" />{a.status}</Badge>
                    <Badge variant={a.buyer_chat_consent ? "default" : "outline"}>Buyer consent: {a.buyer_chat_consent ? "yes" : "no"}</Badge>
                    <Badge variant={a.seller_chat_consent ? "default" : "outline"}>Seller consent: {a.seller_chat_consent ? "yes" : "no"}</Badge>
                    <span className="text-xs text-muted-foreground">{formatRelative(new Date(a.created_at).getTime())}</span>
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-line"><span className="text-muted-foreground">Reason:</span> {a.reason}</p>
                  {a.reviews && (
                    <div className="mt-2 p-2 rounded border bg-muted/40">
                      <RatingStars value={a.reviews.rating} />
                      <p className="text-sm mt-1">{a.reviews.comment ?? <em className="text-muted-foreground">no comment</em>}</p>
                    </div>
                  )}
                  {a.evidence_urls && a.evidence_urls.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">{a.evidence_urls.length} evidence file(s) attached.</p>
                  )}
                  {a.admin_notes && <p className="text-xs text-muted-foreground mt-2">Admin note: {a.admin_notes}</p>}
                  {consented && active && (
                    <p className="text-xs text-emerald-600 mt-2">Chat audit unlocked — you have read access while this appeal is active.</p>
                  )}
                </div>
                {active && (
                  <div className="flex flex-col gap-2 shrink-0 w-[180px]">
                    <Select value={a.status} onValueChange={(v) => resolveReviewAppeal(a.id, v as ReviewAppeal["status"])}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Waiting for Consent">Waiting for Consent</SelectItem>
                        <SelectItem value="Under Review">Under Review</SelectItem>
                        <SelectItem value="Waiting for Additional Evidence">Waiting for Evidence</SelectItem>
                        <SelectItem value="Approved">Approved (remove review)</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="Resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => {
                      const note = prompt("Admin note (optional):") ?? undefined;
                      resolveReviewAppeal(a.id, a.status, note);
                    }}>Add note</Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </TabsContent>


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
