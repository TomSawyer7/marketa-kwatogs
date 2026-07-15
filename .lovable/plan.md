## Seller-only transaction completion

Replace the current mutual handshake with a one-click seller action. The moment the seller marks a transaction done, both the buyer and seller see the "Rate & Review" button and the chat gets a system message. Buyer-side rating includes a text comment (already supported by `ReviewForm`).

### Database (single migration)

1. **RLS on `transactions`**: replace the existing UPDATE policy with two policies:
   - Seller can update `status` to `completed` (and set `confirmed_at`). No other status transitions allowed by buyer.
   - Both parties can still read.
2. **Trigger `transactions_seller_complete`** (BEFORE UPDATE): when the seller flips `status` to `completed`, stamp `confirmed_at`, `seller_confirmed_at`, and `buyer_confirmed_at` with `now()` so downstream logic (review eligibility, completed counts) treats it as fully closed. Reject any attempt by the buyer to set `status = completed`.
3. **Drop** `transactions_handshake` trigger — no longer needed (buyer confirmation is gone).
4. **Keep** `transactions_post_completion_message` — it already inserts the system chat bubble on completion. Update its message text to: *"The seller has marked this transaction as completed. Please rate your experience!"*
5. Grants unchanged (already correct).

### Frontend

**`src/components/inbox/TransactionHub.tsx`**
- Remove the two-sided "You confirmed · waiting" UI.
- Show **"Mark Transaction as Done"** button only when `myRole === "seller"` and `tx.status !== "completed"`.
- Buyer sees a read-only stage badge ("Waiting for seller to complete") — no button.
- On click: `update({ status: "completed" })`. RLS + trigger handle the rest. Realtime already refreshes `tx` via `useThreadTransaction`.
- Keep the existing "Rate them" button gated by `canRate` (works for both roles once status flips).

**`src/pages/ChatThread.tsx`** — no change; `useReviewEligibility` already unlocks review UI as soon as `status = completed`.

**`src/components/reviews/ReviewForm.tsx`** — no change; already supports rating + optional comment for both roles.

### Profile metrics
Already live:
- `useSellerTxStats` counts `transactions.status = completed` → auto-increments on completion.
- `recalc_account_status` runs via `trg_reviews_recalc` after each review insert → aggregate rating recalculated automatically.

No changes needed here.

### Out of scope (per your answers)
- No `rating_token` columns — existing `UNIQUE(transaction_id, reviewer_id)` on `reviews` already prevents double-rating.
- No dedicated `/api/transactions/:id/complete` edge function — RLS + trigger enforce seller-only server-side.

### Files touched
- New migration (RLS policy swap, trigger swap, system-message text update).
- `src/components/inbox/TransactionHub.tsx`.
