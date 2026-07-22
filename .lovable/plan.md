## Goal
Give admins an actual chat viewer when a review appeal has dual consent — right now `TrustPanel` only shows a "Chat audit unlocked" note without any way to read the messages.

## What to add

1. **New component `src/components/admin/AppealChatViewer.tsx`**
   - Dialog opened from the appeal card.
   - Props: `transactionId`, `appealId`, `open`, `onOpenChange`.
   - On open, resolve the linked `thread_id` via `transactions.select("thread_id, buyer_id, seller_id").eq("id", transactionId).single()`.
   - Fetch messages with `supabase.from("messages").select("id, sender_id, body, image_url, kind, created_at, is_unsent").eq("thread_id", threadId).order("created_at")` — RLS `admin_reads_during_active_appeal` already permits this only while both consents are true and status is `Under Review`/`Waiting for Additional Evidence`.
   - Also fetch `profiles` (id, name, avatar_url) for buyer + seller so bubbles can be labeled.
   - Render a read-only scrollable transcript: left/right bubbles by `sender_id`, system messages centered, timestamps, unsent messages shown as "message unsent", images as signed URLs via existing `use-signed-url` (path stored in `image_url`).
   - Empty/loading/permission-error states. If the select returns `[]` and consent conditions aren't met, show an explanatory notice (consent required / status not in audit window).
   - No compose input, no edit, no realtime — purely read-only snapshot with a "Refresh" button.

2. **`src/components/admin/TrustPanel.tsx` changes**
   - Add local state `viewerAppeal: ReviewAppeal | null`.
   - In each review-appeal card, when `consented && active`, replace the green text with a `Button` "View chat audit" that sets `viewerAppeal = a`.
   - When `consented` but `!active`, show disabled "Audit window closed" text.
   - When not consented, keep current consent-status badges and show muted "Awaiting consent from both parties".
   - Render `<AppealChatViewer open={!!viewerAppeal} onOpenChange={…} transactionId={viewerAppeal?.transaction_id} appealId={viewerAppeal?.id} />` at the bottom.
   - Note: moving status to `Under Review` is what unlocks the RLS clause, so keep the existing status Select — the viewer button just becomes usable once status is in the audit window.

## Out of scope
- No schema or RLS changes — the `admin_reads_during_active_appeal` policy on `messages` already handles access. This is a frontend-only fix that surfaces the messages the admin is already permitted to read.
- No realtime subscription in the audit viewer (snapshot + refresh is sufficient for moderation).

## Technical notes
- Use the existing `use-signed-url` hook for image messages so private `chat-attachments` render.
- Since `messages.image_url` may already be a full signed URL depending on how `useThread` stores it, mirror whatever `MessageBubble` does today to avoid divergence.
- Keep styles consistent with existing admin cards (shadcn `Dialog`, `ScrollArea`, `Avatar`).
