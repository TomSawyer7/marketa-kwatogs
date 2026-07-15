
## Goal
Replace the current single-step seller completion with a double handshake:
`discussion → seller_completed → completed`. Reviews unlock only at `completed`.

## 1. Database migration

- Add `'seller_completed'` as a valid `transactions.status` value (text column today — add a CHECK constraint listing allowed states, or extend the enum if one exists; verified during migration).
- Drop the current `Seller updates transaction` UPDATE policy and replace with two scoped policies:
  - **Seller mark-as-done**: `USING (auth.uid() = seller_id AND status IN ('discussion','agreed')) WITH CHECK (auth.uid() = seller_id AND status = 'seller_completed')`.
  - **Buyer confirm**: `USING (auth.uid() = buyer_id AND status = 'seller_completed') WITH CHECK (auth.uid() = buyer_id AND status = 'completed')`.
  - **Buyer dispute (revert)**: `USING (auth.uid() = buyer_id AND status = 'seller_completed') WITH CHECK (auth.uid() = buyer_id AND status = 'discussion')` — used by the "Not yet / Dispute" button.
- Rewrite `transactions_seller_complete()` BEFORE UPDATE trigger:
  - On transition to `seller_completed`: stamp `seller_confirmed_at = now()`.
  - On transition to `completed` (from `seller_completed`): stamp `buyer_confirmed_at` and `confirmed_at = now()`.
- Rewrite `transactions_post_completion_message()` AFTER UPDATE trigger to emit distinct system messages per transition, with `meta.event`:
  - `seller_completed` → *"The seller marked this transaction as done. Waiting for the buyer to confirm."* (`meta.event='seller_completed'`, includes `transaction_id`).
  - `completed` → *"Transaction successfully completed! You can now rate each other."* (`meta.event='completed'`).
  - Buyer reverts back to `discussion` → *"The buyer indicated the transaction is not yet complete."* (`meta.event='buyer_disputed'`).

Rating uniqueness is already enforced by the existing `reviews` unique constraint — no token table added (per prior decision).

## 2. Frontend — `TransactionHub.tsx`

- Progress stepper stages become: `In Discussion` → `Seller Marked Done` → `Completed`.
- Buttons:
  - Seller, status ∈ {discussion, agreed}: **[ Mark as Done ]** → update to `seller_completed`.
  - Seller, status = `seller_completed`: read-only text *"Waiting for buyer confirmation…"*.
  - Buyer, status = `seller_completed`: no button here (handled by in-chat card, see §3).
  - Status = `completed`: existing **[ Rate them ]** button (unchanged).
- `canRate` gating stays tied to `status === 'completed'`.

## 3. Frontend — in-chat buyer confirmation card

- Extend `MessageBubble.tsx` to recognize system messages with `meta.event === 'seller_completed'` and render a prominent card (bordered, primary accent) instead of the plain pill, containing:
  - Text: *"The seller has marked this transaction as completed. Did you receive your item/service?"*
  - Buttons **[ Confirm & Rate ]** and **[ Dispute / Not Yet ]**, shown ONLY when the viewer is the buyer AND the linked transaction is still in `seller_completed` (look up via `meta.transaction_id` — pass current tx from `ThreadView` into `MessageList`/`MessageBubble` as context, or resolve by id).
  - **Confirm & Rate** → update `transactions.status='completed'`, then trigger the existing rate flow (`onRate`) once the update returns.
  - **Dispute / Not Yet** → update `transactions.status='discussion'` (buyer revert policy).
  - After the transaction leaves `seller_completed`, the buttons disappear (card becomes static system text).
- The `completed` and `buyer_disputed` system messages render as the standard centered pill.

## 4. Profile/reviews unlock
No changes — already gated by `status='completed'` + existing `reviews` RLS/unique constraints.

## Technical notes
- All state transitions happen client-side via `supabase.from('transactions').update(...)`; RLS + BEFORE trigger enforce role, source-state, and timestamps. No edge function needed.
- Wire the current `tx` from `ThreadView` down to `MessageList` → `MessageBubble` so the confirmation card knows whether to still show its buttons after realtime status changes.
- Files touched: 1 new migration, `src/components/inbox/TransactionHub.tsx`, `src/components/inbox/MessageBubble.tsx`, `src/components/inbox/MessageList.tsx` (prop pass-through), `src/components/inbox/ThreadView.tsx` (prop pass-through + role/tx context).
