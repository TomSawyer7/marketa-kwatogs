## Goal
Turn the review-appeal admin flow into an explicit decision with three outcomes, apply the correct DB effect on the review, and notify both buyer and seller in real time.

Note on naming: existing schema uses `reviews.status IN ('active','removed_review_only','removed_entirely')` and `review_appeals.resolution_kind IN ('removed_review_only','removed_entirely')`. Plan keeps these names (mapping the prompt's `removed_review_text_only` → existing `removed_review_only`) to avoid a breaking rename across code and existing rows.

## 1. Database migration

**Notifications table**
- `public.notifications`: `id`, `user_id` (fk `profiles.id`), `title`, `message`, `type` (default `'appeal_update'`), `is_read` (default false), `meta jsonb` (appeal_id, review_id, decision), `created_at`.
- GRANTs: `SELECT, UPDATE` to `authenticated` (for own rows / mark-read); `ALL` to `service_role`. No anon.
- RLS: users can `SELECT` and `UPDATE` (only `is_read`) their own rows; inserts happen via security-definer trigger only.
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` and `REPLICA IDENTITY FULL`.

**Resolution trigger enhancement**
Extend the existing `review_appeals_apply_resolution` trigger (or add a second AFTER trigger) so that when `status` transitions to `Approved`/`Rejected`/`Resolved`:
- If `Approved` + `resolution_kind = 'removed_review_only'` → `UPDATE reviews SET status='removed_review_only', comment=NULL`.
- If `Approved` + `resolution_kind = 'removed_entirely'` → `UPDATE reviews SET status='removed_entirely'` (already filtered from lists and aggregate).
- If `Rejected` → `UPDATE reviews SET status='active'` (already done).
- Recalc aggregate via existing `recalc_account_status` path (already fires from `trg_reviews_recalc`); the review UPDATE will trigger it.
- Insert two `notifications` rows (buyer_id, seller_id) with title/message derived from decision + `admin_notes`, and `meta = { appeal_id, review_id, decision, resolution_kind }`.

## 2. Admin UI — explicit resolution picker

`src/components/admin/TrustPanel.tsx` (review-appeals tab):
- Replace the freeform status `Select` with a **Resolve appeal** dialog launched from each active appeal card. Keep the existing intermediate status controls (Pending / Waiting for Consent / Under Review / Waiting for Additional Evidence) as a separate small Select — only the terminal decision goes through the dialog.
- New `src/components/admin/ResolveAppealDialog.tsx`:
  - Radio group with three outcomes:
    1. *Uphold — remove rating and review entirely* (`Approved` + `removed_entirely`)
    2. *Uphold — remove written comment only, keep rating* (`Approved` + `removed_review_only`)
    3. *Dismiss — review is legitimate* (`Rejected`, no `resolution_kind`)
  - Required `admin_notes` textarea (explanation shown to both parties).
  - Submit performs a single `update` on `review_appeals` setting `status`, `resolution_kind`, `admin_notes` — triggers handle the rest.
- Remove the ad-hoc `prompt("Admin note")` button.

## 3. Notifications UI (real-time)

- `src/hooks/use-notifications.ts`: fetch latest 20 for `auth.uid()`, subscribe to `postgres_changes` INSERT on `notifications` filtered by `user_id`, expose `unreadCount`, `markRead(id)`, `markAllRead()`. Cleanup channel in `useEffect` return.
- `src/components/notifications/NotificationBell.tsx`: bell icon + unread badge in `Header.tsx`; opens a `Popover` listing items (title, message, relative time, unread dot). Clicking marks read and, when `meta.review_id` exists, navigates to the relevant profile/review.
- Toast on new incoming notification while app is open (sonner).

## 4. Review list — reflect new state
`src/components/reviews/UserReviewList.tsx` already handles `removed_review_only` (comment scrubbed) and filters `removed_entirely`. No change needed beyond confirming aggregate recomputes (existing trigger chain covers it).

## 5. Out of scope
- Email delivery via edge function (prompt marks it optional). Structure allows adding a `pg_net`/edge-function hook later; not built now.
- Renaming `removed_review_only` → `removed_review_text_only` across the codebase (cosmetic, would touch multiple files and existing data).

## Technical notes
- All notification INSERTs happen inside the existing `SECURITY DEFINER` trigger, so RLS on `notifications` can safely block direct client inserts.
- Realtime: enable publication + `REPLICA IDENTITY FULL` on `notifications`; subscribe with a filter `user_id=eq.<me>` so each client only receives its own rows.
- The dialog submits status + resolution_kind + admin_notes in one update; the trigger's existing consent-revocation and review-status logic remains intact.
