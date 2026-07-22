## Problem

Data confirms buyers never flip `buyer_chat_consent` to true — every recent appeal shows `buyer_chat_consent=false` even after the buyer clicks "Grant consent". RLS policies and grants look correct, so the update is either erroring silently in the client or the banner isn't refreshing/subscribed to changes. There's also no realtime channel on `review_appeals`, so the other party never sees consent flips live.

## Fix

1. **`src/components/inbox/AppealConsentBanner.tsx`**
   - Log the full Supabase error object (not just `error.message`) and surface it via toast when the update fails — this exposes any RLS/trigger error the buyer is hitting.
   - After `update`, use `.select("buyer_chat_consent, seller_chat_consent, status").maybeSingle()` and hydrate state from the returned row instead of re-fetching, so a silently zero-row update becomes visible (empty result ⇒ show "Update blocked — please retry").
   - Subscribe to `postgres_changes` on `public.review_appeals` filtered by `id=eq.<row.id>` inside a `useEffect` (cleanup with `removeChannel`) so both parties see consent state update live.

2. **Realtime publication**
   - Add `review_appeals` to the `supabase_realtime` publication and set `REPLICA IDENTITY FULL` so the subscription above delivers changes.

3. **Verify**
   - After the change, have the buyer click Grant consent; confirm the badge flips to "granted", the seller's open banner updates without refresh, and the row in `review_appeals` shows `buyer_chat_consent=true`, `buyer_consent_at` set, and status auto-moves to `Under Review` when both are true.
   - If the toast now surfaces a specific RLS/trigger error, address it (most likely candidate: the `review_appeals_guard_update` trigger rejecting the buyer's write) in the same pass.

## Technical notes

- Existing policies (`Buyer updates own consent`, `Seller updates own evidence`, `Admins update appeals`) and table grants to `authenticated` are already correct; no policy changes planned unless step 3 uncovers a trigger rejection.
- The `review_appeals_auto_status` trigger already promotes status to `Under Review` once both consents are true — no change needed there.
- No UI redesign; banner layout stays as-is.
