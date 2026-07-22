## Goal

Add a seller-driven **Review Appeal System** on top of the existing `reviews` table, with dual-consent (buyer + seller) time-bound admin chat audit and a full admin resolution workflow. Existing `account_appeals` (account-level) and `review_reports` (buyer reporting a review) stay as-is — this new flow is specifically for sellers appealing a review left on them.

## Current state (verified)

- `reviews` has: `id, transaction_id, reviewer_id, reviewee_id, role, rating, tags, comment, created_at, updated_at` — no `status` column yet.
- `messages` RLS currently restricts reads to thread participants (`user_a`/`user_b` in `threads`).
- `transactions` links buyer/seller/thread, giving us the join path for the RLS policy.
- `has_role(uuid, app_role)` already exists for admin checks.

## Database changes (single migration)

1. **`reviews.status`** — add `text` column with values `'active' | 'removed_review_only' | 'removed_entirely'`, default `'active'`. Backfill existing rows to `'active'`.
2. **`review_appeals`** table:
   - `id, review_id → reviews, transaction_id → transactions, seller_id, buyer_id`
   - `reason text not null, evidence_urls text[] default '{}'`
   - `buyer_chat_consent bool default false, seller_chat_consent bool default true` (seller filing implies consent)
   - `buyer_consent_at, seller_consent_at timestamptz`
   - `status text` in (`Pending, Waiting for Consent, Under Review, Waiting for Additional Evidence, Approved, Rejected, Resolved`), default `'Waiting for Consent'`
   - `admin_notes text, resolved_by uuid, resolved_at timestamptz, created_at, updated_at`
   - Unique constraint on `review_id` (one active appeal per review).
3. **Grants + RLS** on `review_appeals`:
   - Seller can insert/select own appeal where `seller_id = auth.uid()` and only when they are the `reviewee_id` of the review.
   - Buyer can select + update own consent fields where `buyer_id = auth.uid()` (update limited to `buyer_chat_consent`, `buyer_consent_at` via trigger guard).
   - Admin (`has_role(auth.uid(),'admin')`) can select/update all.
4. **`messages` RLS — add admin dual-consent read policy** (additive, does not weaken existing participant policy):

   ```sql
   CREATE POLICY "admin_reads_during_active_appeal"
   ON public.messages FOR SELECT
   TO authenticated
   USING (
     public.has_role(auth.uid(), 'admin')
     AND EXISTS (
       SELECT 1
       FROM public.review_appeals ra
       JOIN public.transactions t ON t.id = ra.transaction_id
       WHERE t.thread_id = messages.thread_id
         AND ra.buyer_chat_consent = TRUE
         AND ra.seller_chat_consent = TRUE
         AND ra.status IN ('Under Review','Waiting for Additional Evidence')
     )
   );
   ```
   Consent is time-bound: when admin sets status to `Approved`/`Rejected`/`Resolved`, the `EXISTS` clause fails and admin reads are immediately revoked. A trigger also nulls consent timestamps on resolution.
5. **Storage bucket `appeal-evidence`** (private) via `supabase--storage_create_bucket`, with `storage.objects` RLS: seller can upload/read own path `appeals/<appeal_id>/…`; admin can read all under the bucket.
6. **Trigger** `review_appeals_apply_resolution`: when `status` transitions to `Approved`, update linked `reviews.status`:
   - Admin toggles in UI decide `removed_review_only` (hide comment/tags, keep rating) vs `removed_entirely` (exclude from aggregate). Stored via `admin_notes` metadata or a small `resolution_kind` column — plan adds `resolution_kind text` on `review_appeals`.
7. **`recalc_account_status`** and rating aggregates: update review-fetch queries and `RatingsSummary`/`UserReviewList` to filter `status = 'active'`; `removed_review_only` still counts rating but hides comment; `removed_entirely` is excluded from average.

## Frontend

Reuse shadcn/ui and existing patterns.

### Seller side
- **`components/reviews/AppealReviewDialog.tsx`** — opened from a new "Appeal this review" action in `UserReviewList` (only visible to the reviewee on their own profile, and only if `status='active'` and no existing appeal). Fields: reason (textarea), evidence uploader (multi-file → `appeal-evidence` bucket), submit.
- **`pages/AppealsCenter.tsx`** or a "My Appeals" tab under `Settings`/`Profile` — list of the user's appeals with status badges, ability to upload additional evidence when status = `Waiting for Additional Evidence`.

### Buyer side (consent)
- **Notification banner + inbox thread system message** when an appeal is filed against a review they wrote:
  - System message inserted into the linked `threads` row via `messages(kind='system', meta={appeal_id})`.
  - Renders a "Review under appeal — allow admin to audit this chat?" card with **Allow** / **Decline** buttons that flip `buyer_chat_consent`.
- Consent card re-renders as "Consent granted / revoked" once acted on.

### Admin side (`TrustPanel`)
- New **Appeals** tab alongside Reports/Appeals/Restricted:
  - Table of `review_appeals` with filters by status.
  - Detail drawer: review content, appeal reason, evidence gallery (signed URLs), consent state indicators, linked chat viewer (only queries when both consents true and status is `Under Review`/`Waiting for Additional Evidence`), admin notes, and action buttons: `Move to Under Review`, `Request more evidence`, `Approve (remove comment / remove entirely)`, `Reject`, `Mark Resolved`.
- Chat viewer is a lightweight read-only `MessageList` that queries `messages` for the thread; RLS enforces access — no bypass in the client.

## Reviews display updates
- `UserReviewList` and `RatingsSummary` filter/handle `status`:
  - `removed_review_only`: show as "Comment removed by moderation" with the star rating still visible.
  - `removed_entirely`: hidden and excluded from aggregate.

## Out of scope
- Realtime push for consent state (polling on tab open is enough for v1).
- Automated ML/heuristic flagging — appeals are seller-initiated.
- Localization of status labels.

## Technical notes
- All new tables/functions use `SET search_path = public`.
- No `EXECUTE` grants on new `SECURITY DEFINER` functions to `anon`/`authenticated`.
- Migration must include explicit `GRANT`s on `review_appeals` and any new tables before `ENABLE ROW LEVEL SECURITY`.
- Evidence upload uses signed URLs; nothing public.
