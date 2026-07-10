
# Rating & Feedback System

A peer-to-peer review system tied strictly to completed transactions, with reporting, automatic account flagging, and an in-app appeal flow.

## User-facing flow

1. **Mark as sold.** On a listing they own, the seller opens "Mark as sold" and picks the buyer (search users by name/email). This creates a `transaction` in `pending_confirmation`.
2. **Buyer confirms.** Buyer sees "Confirm purchase" in a new **Transactions** tab on their profile. On confirm → status becomes `completed` and both sides unlock a "Leave review" button.
3. **Review.** 1–5 stars, up to 3 quick tags (As described, On time, Communicative, Fair price, Friendly / plus negative counterparts), optional comment (max 500 chars). Each side can review once per transaction.
4. **Public reviews.** Seller and buyer profiles show average rating, review count, and a reviews tab. Existing hard-coded `5.0` on profile/seller pages is replaced with real aggregates.
5. **Report a review.** Any user can report a review as fraudulent/abusive with a reason.
6. **Auto-flag.** When a user hits **3+ upheld reports OR average rating < 2.0 with ≥ 5 reviews**, their account status flips to `restricted` (cannot create listings, cannot leave reviews; browsing still works).
7. **Appeal.** Restricted users see an appeal banner + form. Admins review appeals in `/admin` and can uphold restriction, lift it, or escalate to `suspended`.

## Data model (new tables in `public`)

- `transactions` — `listing_id`, `seller_id`, `buyer_id`, `status` (`pending_confirmation` | `completed` | `cancelled`), `confirmed_at`.
- `reviews` — `transaction_id`, `reviewer_id`, `reviewee_id`, `role` (`buyer` | `seller`), `rating` (1–5), `tags` (text[]), `comment`, unique on `(transaction_id, reviewer_id)`.
- `review_reports` — `review_id`, `reporter_id`, `reason`, `status` (`pending` | `upheld` | `dismissed`), `resolved_by`, `resolved_at`.
- `account_status` — `user_id` PK, `status` (`active` | `restricted` | `suspended`), `reason`, `updated_by`, `updated_at`.
- `account_appeals` — `user_id`, `message`, `status` (`pending` | `approved` | `denied`), `admin_note`, `resolved_by`, `resolved_at`.
- View/function `user_rating_stats(user_id)` → `avg_rating`, `review_count`, `upheld_report_count` for cheap reads.

RLS summary (plain English):
- Anyone signed in can read reviews and rating stats; anonymous browsing also allowed for reviews so seller pages render.
- Only the seller can create a transaction for their own listing; only the named buyer can confirm it.
- A user can insert a review only if they are a participant of a `completed` transaction and haven't already reviewed it.
- A user can report any review once. Only admins can update report status, `account_status`, or resolve appeals.
- A user can insert/read their own appeals; admins can read/update all.

## Auto-flag logic

A `SECURITY DEFINER` function `public.recalc_account_status(user_id)` runs after: review insert, report status change. It computes stats and, if thresholds are hit, upserts `account_status` to `restricted` with reason `auto:low_rating` or `auto:reports`. Admin manual actions always win over auto values.

## UI changes

- **New page `/transactions`** — buyer & seller lists with confirm / leave review actions.
- **Listing detail** — seller sees "Mark as sold → pick buyer" action.
- **Profile / SellerPage** — real avg rating + review count, new "Reviews" tab, "Report" button on each review.
- **Restricted banner** — global banner via `VerificationGate` sibling when `account_status = restricted/suspended`, with link to appeal form. Sell/review actions disabled.
- **Admin (`/admin`)** — new tabs: **Reports** (uphold/dismiss), **Appeals** (approve/deny), **Restricted users** (manual lift/suspend).

## Technical notes

- Migration creates all tables with grants (`authenticated` CRUD where policies allow, `service_role` all, `anon` read on `reviews` + `user_rating_stats`), enables RLS, adds `updated_at` triggers, and creates the recalc function + triggers.
- Client uses existing `supabase-js`; no edge functions needed. Admin mutations gated by `has_role(auth.uid(), 'admin')` in RLS.
- Extend `useMarketa` (or a new `useTransactions` hook) for transactions/reviews; keep listing store untouched.
- Zod validation on all forms (rating range, comment length, tag whitelist, appeal message length).
- Replace hard-coded rating strings in `Profile.tsx` and `SellerPage.tsx` with values from `user_rating_stats`.

## Out of scope

- Messaging / chat between buyer & seller.
- Email notifications for reviews/appeals.
- Editing or deleting a submitted review (only reporting).
