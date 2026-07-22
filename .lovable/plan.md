## Messenger-style chat: reply, edit, unsend, image removal

Add Messenger-style message actions on top of the existing split-view inbox. Keep the current dedup, listing banner, search, and transaction hub — only extend messaging behavior.

### 1. Database migration

Alter `public.messages`:
- Add `reply_to_message_id uuid null references public.messages(id) on delete set null`
- Add `is_edited boolean not null default false`
- Add `is_unsent boolean not null default false`
- Add `edited_at timestamptz null`
- Make `body` nullable (allow image-only messages; keep existing rows valid)
- Index on `reply_to_message_id`

RLS updates on `messages`:
- UPDATE policy: sender can update own message when `is_unsent = false`; allowed column changes limited to `body`, `image_url`, `is_edited`, `edited_at`, `is_unsent` via a trigger that rejects edits to `thread_id`, `sender_id`, `created_at`, `kind`, `reply_to_message_id` (reply target is immutable after send)
- Keep SELECT/INSERT policies unchanged
- No hard DELETE from client — "unsend" is a soft flag

Trigger: on UPDATE, if `is_unsent` transitions to true, clear `body` to null and `image_url` to null (server-side scrub) and set `edited_at = now()`. If `body` changes and not unsend, set `is_edited = true`, `edited_at = now()`.

Storage: when unsending or removing an image, client also deletes the object from private `chat-attachments` bucket (path stored in `image_url`). Existing bucket policies already allow sender delete; verify and add a policy if missing.

### 2. Frontend components

New/updated files:
- `src/components/inbox/MessageBubble.tsx` — add hover/long-press action menu (shadcn `DropdownMenu`), render quoted reply block when `reply_to_message_id` present, render "Message unsent" muted style when `is_unsent`, `(edited)` suffix when `is_edited`. Actions: Reply, Edit (own text only), Unsend, Remove image (own, when image present).
- `src/components/inbox/Composer.tsx` — add reply/edit banner above input with cancel; support edit mode (submit updates existing row instead of insert); keep existing image preview.
- `src/components/inbox/ChatPane.tsx` — hold `replyTo` and `editing` state, pass handlers to bubble + composer, resolve quoted message previews from `chat.messages`.
- `src/hooks/use-thread.ts` — new actions: `editMessage(id, body)`, `unsendMessage(id)`, `removeImage(id)`; extend `send`/`sendImage` to accept optional `replyToId`; realtime UPDATE handler already merges by id (works for edit/unsend).
- `src/lib/inbox.ts` — extend `Message` type with `reply_to_message_id`, `is_edited`, `is_unsent`, `edited_at`; allow `body: string | null`.

### 3. UX details

- Hover on desktop reveals a compact icon row (Reply, More…); More opens dropdown with Edit/Unsend/Remove image scoped by ownership + content.
- Long-press on mobile opens same dropdown.
- Quoted reply block shows sender name + 1-line snippet, clickable to scroll to original.
- Edit is text-only; images cannot be swapped (use Remove image + resend instead).
- Unsend confirms via shadcn `AlertDialog`.
- Profile navigation via avatar/name already routes to `/seller/:id` — keep as-is (out of scope for this plan unless user wants modal).

### 4. Out of scope

- Public profile modal (already routes to seller page)
- Changing dedup, search, or transaction hub logic
- Message reactions, forwarding, or read receipts beyond current

### Technical notes

- Reply target immutability enforced via trigger to avoid RLS column-check complexity.
- Image deletion best-effort: delete storage object first, then null `image_url`; ignore storage 404s.
- Types file `src/integrations/supabase/types.ts` regenerates after migration approval; frontend edits land after that.
