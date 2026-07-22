## Chat & Inbox UI Refactor — Header, Stepper, Proposals, Profile Peek

Scope is presentation-layer polish on top of the existing `threads` / `messages` / `transactions` tables. No schema changes needed: our current `transactions.status` (`proposed` → `agreed` → `seller_completed` → `completed`) already maps to the three stepper stages, and proposals live as `messages.kind = 'proposal'` linked to a `transactions` row. I'll keep that model rather than introducing new `conversations` / `proposals` tables.

### 1. Chat header — cleaner + clickable profile

`src/components/inbox/ChatPane.tsx`
- Slim the header to one row: avatar + name + presence dot + a right-side "kebab" menu (report / mute placeholder).
- Wrap avatar and name in a button that opens a new `ProfilePeekDialog` instead of navigating away. Long-press / kebab still exposes "Open full profile" → `/seller/:id`.
- Remove the current busy `Link` styling; use `hover:underline` on name only.

New: `src/components/inbox/ProfilePeekDialog.tsx` (shadcn `Dialog`, `Sheet` on mobile)
- Loads from `profiles` + `verified_users` + `reviews` aggregate + user's active `listings` (limit 6).
- Sections: avatar/name/joined date/verified badge → rating summary (reuse `RatingsSummary` compact variant) → active listings grid (reuse `ListingCard` small).
- Footer: "View full profile" link to `/seller/:id`, "Message" (closes dialog since we're already in the thread).

### 2. Transaction stepper + proposal bar (fix visual clutter)

Refactor `src/components/inbox/TransactionHub.tsx` into a compact two-part strip directly under the header:

```text
┌─────────────────────────────────────────────────────────────┐
│  ● In Discussion ──── ○ Marked Done ──── ○ Completed        │
├─────────────────────────────────────────────────────────────┤
│  [contextual action row — one primary CTA + secondary]      │
└─────────────────────────────────────────────────────────────┘
```

- **Stepper**: replace the current pill row with a thin connected stepper (dot + label + hairline connector). Active step tinted `primary`, done steps filled, pending steps muted. Collapses to icons-only under 380px.
- **Action row** — exactly one primary button per state, no floating extras:
  - No tx yet → `+ Create Proposal` (primary).
  - Tx `proposed`/`agreed`, viewer = seller → `Mark as Done` (primary) + subtle "Edit proposal" text button.
  - Tx `proposed`/`agreed`, viewer = buyer → muted status text "Waiting for seller to mark as done".
  - Tx `seller_completed`, viewer = buyer → `Confirm & Rate Seller` (primary; confirms + opens review dialog).
  - Tx `seller_completed`, viewer = seller → muted "Waiting for buyer confirmation".
  - Tx `completed` → `Write a Review` if `canRate`, else "Transaction completed" muted line.

New: `ProposalCardBanner` (rendered inline in the action row when there's a pending proposal message and `tx.status IN ('proposed','agreed')`)
- Compact card: listing thumb + title + proposed price + `Accept` / `Decline` / `Counter` (counter reopens `ProposalDialog` prefilled).
- Accept → update `transactions.status` to `agreed`. Decline → set to `discussion` + system message. Counter → new proposal message + updated tx amount.

### 3. Sidebar row — profile peek + dedup polish

`src/pages/Inbox.tsx` (`ThreadItem`)
- Clicking the avatar (not the row) opens the same `ProfilePeekDialog`. Row click still opens the thread.
- Dedup is already enforced at the DB level via the unique index on `(user_a, user_b, listing_id)`, so no schema work; just verify `useInbox` doesn't render stale duplicates after the earlier merge migration.

### 4. Preserved from prior work
- Messenger hover actions (reply/edit/unsend/remove image) in `MessageBubble` stay untouched.
- `chat-attachments` signed URLs stay untouched.

### Files touched

- edit `src/components/inbox/ChatPane.tsx` — slim header, wire profile peek
- edit `src/components/inbox/TransactionHub.tsx` — new stepper + single-CTA action row
- new `src/components/inbox/ProfilePeekDialog.tsx`
- new `src/components/inbox/ProposalCardBanner.tsx`
- edit `src/components/inbox/ProposalDialog.tsx` — support counter/prefill
- edit `src/pages/Inbox.tsx` — avatar-click opens peek
- minor: `src/components/reviews/RatingsSummary.tsx` — add `compact` prop if not present

### Out of scope (call out explicitly)
- No new `conversations` / `proposals` tables — existing `threads` + `transactions` + `messages(kind='proposal')` already model this and are wired to RLS, realtime, and the completion state machine. Adding parallel tables would fork state.
- No changes to review eligibility rules or completion triggers.
