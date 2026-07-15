## Wire "Send seller a message" to real messaging

Replace the demo toast on the listing detail page with a real thread + message insert, then redirect the buyer into the chat.

### Behavior
- If not signed in → redirect to `/auth`.
- If the current user is the seller → the message box is already hidden (unchanged).
- On submit:
  1. Use `getOrCreateThread(buyerId, sellerId, listingId)` from `src/lib/inbox.ts` (already handles the "check existing / create new" logic with a normalized `(user_a, user_b)` pair scoped by `listing_id`).
  2. Insert the textarea text into `messages` (`sender_id = buyer`, `kind = "text"`). The existing `messages_bump_thread` trigger updates `threads.last_message_at`.
  3. Navigate to `/inbox/:threadId`, which already loads the thread live over Supabase Realtime via `useThread`.
- Placeholder text ("Hi! Is '…' still available?") is used as the actual message when the textarea is empty, matching the visible prompt.
- Button shows a spinner while sending and is disabled to prevent double submits. Errors surface via `toast.error`.

### Not doing
- No new `/api/chat/initiate` endpoint — Supabase + RLS is our backend; a redundant edge function would just re-implement `getOrCreateThread`.
- No `transactions` row on first message. Transactions are created explicitly via the existing `ProposalDialog` in the chat (status `proposed`), which matches the current schema and the `TransactionHub` flow. Auto-creating a placeholder here would either violate the status check constraint or clutter every conversation with an unused transaction.

### Files
- `src/pages/ItemDetail.tsx` — replace `onSendMessage` with async handler using `useAuth` + `getOrCreateThread` + `supabase.from("messages").insert(...)` + `navigate("/inbox/" + threadId)`; add `sending` state for the button spinner; use placeholder as fallback body.
