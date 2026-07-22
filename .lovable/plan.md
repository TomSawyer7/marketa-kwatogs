
## Goal
Overhaul the Inbox into a Facebook Marketplace-style split view, eliminate duplicate threads, add image attachments via a private Supabase Storage bucket, and make user avatars/names deep-link to public profiles.

## 1. Database migration

Keep the existing `threads` schema. Additions only:

- Deduplication: since `threads` already stores `(user_a, user_b, listing_id)` with the pair pre-sorted by `pairIds()`, add a partial unique index so one thread exists per listing-per-pair, plus one general-DM thread per pair:
  - `CREATE UNIQUE INDEX threads_pair_listing_unique ON threads(user_a, user_b, listing_id) WHERE listing_id IS NOT NULL;`
  - `CREATE UNIQUE INDEX threads_pair_dm_unique ON threads(user_a, user_b) WHERE listing_id IS NULL;`
  - Pre-clean any existing duplicate rows before adding the indexes (merge messages into the oldest thread, delete the rest).
- `ALTER TABLE messages ADD COLUMN image_url text;` (nullable; text bubbles keep working)
- Create private storage bucket `chat-attachments` via `supabase--storage_create_bucket` (public=false).
- Storage RLS on `storage.objects` for bucket `chat-attachments`:
  - INSERT: authenticated user, path prefix must be `<thread_id>/...`, and user must be `user_a` or `user_b` of that thread.
  - SELECT: same participant check (used for signed URL generation and any direct reads).

## 2. Frontend refactor

### Split-view layout (`src/pages/Inbox.tsx`)
- Desktop (≥ md): two-column grid — left sidebar (chat list, ~340px) + right pane (active chat or empty state).
- Mobile: current behavior — list on `/inbox`, tapping navigates to `/inbox/:id` full-screen.
- Move ChatThread rendering into a shared `<ChatPane threadId>` component so both routes reuse it.
- Route `/inbox/:id` on desktop highlights the row in the sidebar and mounts `<ChatPane>` in the right column; on mobile it renders full-screen as today.

### Sidebar (left column)
- Reuse `useInbox` (already dedupes by `thread_id`). Add listing thumbnail + title lookup so each row shows a small listing-context badge when `thread.listing_id` is set.
- Keep tabs (All / Unread / Active Transactions) and search input.
- Real-time search: filter by other user name, listing title, and last message body. Existing "people search" stays for starting new chats.

### Chat pane (right column)
- Header: avatar + name (links to `/seller/:id`), online/typing status.
- Listing context bar: thumbnail, title, price, status pill ("Active"/"Sold"/"Completed") when `thread.listing_id` exists. Clickable → `/item/:id`.
- Message feed: existing `MessageBubble`, extended to render `image_url` as an `<img>` inside the bubble (resolved via signed URL). Realtime subscription is already in place.
- Composer: add a paperclip button that opens a hidden file input (accept="image/*"). On select:
  1. Validate size (≤ 5 MB) and type.
  2. Upload to `chat-attachments/<thread_id>/<uuid>.<ext>`.
  3. Insert a `messages` row with `image_url = <storage path>` and empty `body` (or caption if user typed one).
  4. On render, call `supabase.storage.from('chat-attachments').createSignedUrl(path, 3600)` and cache the resolved URL per message id.
- Optimistic preview while uploading.

### Deduplication safety
- `getOrCreateThread` in `src/lib/inbox.ts` already selects before inserting. Wrap the insert in a `try/catch`: if the new unique constraint fires (Postgres error `23505`), re-select and return the existing row. Prevents races when two tabs open a chat at once.

### Profile navigation
- Already wired via `Link to={/seller/:id}`; audit Inbox + ChatThread to ensure every avatar/name (sidebar rows too) is a link to the other user's public profile.

## 3. Files touched

- `supabase/migrations/*` (new migration via tool)
- `src/lib/inbox.ts` — dedupe-safe getOrCreateThread
- `src/hooks/use-inbox.ts` — join listing thumbnail/title/price/status
- `src/hooks/use-thread.ts` — extend Message type with image_url
- `src/lib/inbox.ts` types — add `image_url`
- `src/pages/Inbox.tsx` — new split layout, listing badge on rows
- `src/pages/ChatThread.tsx` — thin wrapper around new `<ChatPane>` (mobile route)
- `src/components/inbox/ChatPane.tsx` — new, extracted chat surface
- `src/components/inbox/ListingContextBar.tsx` — new
- `src/components/inbox/Composer.tsx` — new, with attachment button
- `src/components/inbox/MessageBubble.tsx` — render image bubbles + signed-URL hook
- `src/hooks/use-signed-url.ts` — new, small cache for signed URLs

## 4. Out of scope
- No rename of `threads`→`conversations` (per your choice).
- No changes to transaction/rating flow.
- Leaked password protection (unrelated preexisting Auth warning).

## 5. Verification
- Send text + image in a thread; confirm image renders via signed URL for both participants and 403s for a non-participant.
- Open the same listing chat from two tabs → only one thread row exists.
- Search filters sidebar in real-time; tabs still work.
- Desktop shows split view; mobile still routes full-screen.
