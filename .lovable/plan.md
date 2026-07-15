## Goal
Build a Messenger-style Inbox with real-time chat, integrated transaction handshake, and automatic rating unlock when both parties mark a transaction complete. Reuse the existing `transactions` table + `useReviewEligibility` (already gates reviews on `status='completed'`).

## 1. Database (single migration)

### `threads`
- `id uuid pk`, `user_a uuid`, `user_b uuid` (store `LEAST/GREATEST` so pair is unique), `listing_id uuid null`, `transaction_id uuid null`, `last_message_at timestamptz`, `created_at`, `updated_at`
- unique(user_a, user_b, listing_id)
- RLS: participants only (`auth.uid() IN (user_a, user_b)`)

### `messages`
- `id uuid pk`, `thread_id uuid fk`, `sender_id uuid`, `body text`, `kind text default 'text'` (`'text' | 'system' | 'proposal' | 'completion_request'`), `meta jsonb`, `read_at timestamptz null`, `created_at`
- RLS: sender can insert; participants can select; participants can update `read_at` on messages not sent by them.
- Trigger: on insert, update `threads.last_message_at`.

### `transactions` additions
- add `thread_id uuid null` (link back)
- add `buyer_confirmed_at timestamptz`, `seller_confirmed_at timestamptz` — used for two-party handshake
- new statuses: `'proposed' | 'agreed' | 'completed' | 'cancelled'` (already have `completed`)
- Trigger `handshake_completion`: when both `buyer_confirmed_at` and `seller_confirmed_at` are set, set `status='completed'`, `confirmed_at=now()`, and insert a system message into the linked thread ("Transaction successful! You can now rate each other."). This automatically flips `useReviewEligibility` to `eligible`.

### Realtime
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.threads, public.transactions;`
- `REPLICA IDENTITY FULL` on all three.

### Presence
- Use Supabase Realtime **presence channel** (`presence:inbox`) — no `presence` table needed.

### Grants (per project rule) for all new tables:
- `GRANT SELECT, INSERT, UPDATE ON public.threads TO authenticated;`
- `GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;`
- `GRANT ALL` to `service_role` on both.

## 2. Frontend

### Routes / pages
- `src/pages/Inbox.tsx` — thread list + search
- `src/pages/ChatThread.tsx` (route `/inbox/:threadId`) — chat UI

### Reused
- `useAuth`, `supabase` client, existing `RatingsSummary`/`useReviewEligibility`, shadcn `Tabs`, `Input`, `Avatar`, `Badge`, `Button`.

### Inbox layout
```text
┌─────────────────────────────────────────────┐
│ [🔍 Search people, chats…]                  │
├─────────────────────────────────────────────┤
│ [All] [Unread] [Active Transactions]        │
├─────────────────────────────────────────────┤
│ ● [Avatar] Name          12:04   [3]        │
│           "sure, see you at 5…"             │
│ ○ [Avatar] Name          Mon                │
│           "You: sent proposal"              │
└─────────────────────────────────────────────┘
```
- Empty search state → "Recent Chats".
- Typing → two sections: **Messages** (thread name/snippet match, ILIKE on latest message body) and **New People** (profiles.name/location ILIKE, excluding existing thread partners). Selecting a person → `getOrCreateThread(otherId)` then navigates to `/inbox/:threadId`.
- Presence dot from Realtime presence channel.

### Chat thread layout
```text
┌─────────────────────────────────────────────┐
│ ← [Avatar] Name  ●online                    │
│    Status chip: In Discussion ▸ Agreement ▸ Completed │
│    [Create Proposal] / [Mark as Completed]  │
├─────────────────────────────────────────────┤
│                          [Hi! ...]  ✓✓      │
│  [Sounds good]                              │
│  ─── system: Transaction successful ───     │
│                          [Rate them ★]      │
├─────────────────────────────────────────────┤
│ [ Type a message…                    ][ ➤ ] │
└─────────────────────────────────────────────┘
```
- Sent bubbles: `bg-primary text-primary-foreground` right; received: `bg-muted text-foreground` left.
- Read receipts: single check on delivered, double check when the recipient's `read_at` is set.
- Typing indicator via Realtime broadcast (`channel.send({type:'broadcast', event:'typing'})`).
- Subscribe to `postgres_changes` on `messages` for the current `thread_id` INSIDE `useEffect` with cleanup (per project realtime rule).
- Mark incoming messages read on view (batch `update messages set read_at=now() where thread_id=? and sender_id<>me and read_at is null`).

### Transaction hub (chat header)
- Shows current `transactions` row for the thread (if any).
- State chip: `proposed → agreed → completed`.
- "Create Proposal" opens a small dialog (pick one of the seller's listings + price) → inserts `transactions` row `status='proposed'` and a `kind='proposal'` message.
- "Mark as Completed" button per user → sets `buyer_confirmed_at` or `seller_confirmed_at` depending on role. When both set, DB trigger flips to `completed` and posts the system message.
- After completion, chat renders a "Rate [User]" button that opens the existing `ReviewForm` (already wired to `useReviewEligibility`).

### State machine
```text
idle ─(open thread)→ chatting
chatting ─(create proposal)→ transaction_pending (status=proposed|agreed)
transaction_pending ─(both confirm)→ transaction_successful (status=completed)
transaction_successful ─(auto)→ rating_unlocked   // useReviewEligibility=eligible
```

## 3. Files
- migration: threads, messages, transactions alter + trigger + realtime + grants
- `src/pages/Inbox.tsx`
- `src/pages/ChatThread.tsx`
- `src/components/inbox/ThreadList.tsx`
- `src/components/inbox/SearchResults.tsx`
- `src/components/inbox/MessageBubble.tsx`
- `src/components/inbox/TransactionHub.tsx`
- `src/components/inbox/ProposalDialog.tsx`
- `src/hooks/use-thread.ts` (fetch+realtime messages)
- `src/hooks/use-inbox.ts` (thread list + realtime)
- `src/hooks/use-presence.ts` (Realtime presence channel)
- add `/inbox` and `/inbox/:threadId` to `src/App.tsx`
- add Inbox link to `src/components/layout/Header.tsx`
- ChatThread wires the existing `ReviewForm` for the "Rate" button.

## Out of scope (this pass)
- Attachments/images, group chats, message editing/deletion, push notifications.
