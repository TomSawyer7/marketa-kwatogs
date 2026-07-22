## Goal
Redesign the Trust & Safety "Review appeals" tab into a dedicated **Appeal Management Workspace** with a KPI header and split-panel queue/detail layout. All other tabs (Reports, Account appeals, Restricted) stay as-is.

## 1. KPI header (top of review-appeals tab)
Four compact metric cards using existing card/border tokens:
- **Active Appeals** — count where status ∉ (Approved, Rejected, Resolved)
- **Waiting for Consent** — status = "Waiting for Consent" OR (Pending with at least one missing consent)
- **Under Review** — status = "Under Review" or "Waiting for Additional Evidence"
- **Resolved Today** — terminal status with `resolved_at` (fallback: updated within last 24h) on today's date

Each card: label, big number, small icon (ShieldAlert, Clock, Gavel, CheckCircle2), matching the Marketa admin visual language already used by `StatsHeader`.

## 2. Split-panel layout (replaces current list of full-width cards)
Grid `md:grid-cols-[380px_1fr]`, height-bounded like the verifications tab.

**Left — Appeals Queue**
- Filter tabs: `All` · `Waiting for Consent` · `Under Review` · `Resolved` (client-side filter over already-fetched `reviewAppeals`).
- Compact row per appeal:
  - Seller name → Buyer name (fetched from `profiles`)
  - Listing title + price (join via `transactions.listing_id → listings`)
  - Star chip for disputed rating
  - Status badge + relative time
  - Consent pips: `B ✅/❌  S ✅/❌`
- Selected row highlighted; empty state when filter yields nothing.

**Right — Appeal Detail Workspace**
Sections stacked, each in a bordered card:
1. **Disputed review** — buyer name, stars, comment, timestamp.
2. **Seller's appeal** — reason text + evidence gallery (thumbnails from `appeal-evidence` bucket via `useSignedUrl`; click opens a `Dialog` lightbox with prev/next).
3. **Privacy & Chat Audit box**
   - Locked: shield icon, `Chat Locked — Waiting for Dual Consent` + per-party status chips.
   - Unlocked (both consented AND status ∈ Under Review / Waiting for Additional Evidence): green "Temporary Chat Access Granted" banner + inline embed (reuse `AppealChatViewer` transcript rendering extracted into a shared `AppealChatTranscript` component, or keep the "Open transcript" button as-is).
   - Post-resolution: neutral state "Audit window closed".
4. **Admin Resolution panel** (only when appeal is active)
   - `RadioGroup` with the three outcomes matching existing `ResolveAppealDialog` payload mapping (`removed_entirely`, `removed_review_only`, `rejected`).
   - `Textarea` for admin notes (min 10 chars, matches current validation).
   - "Submit Decision & Notify Both Parties" button → same update on `review_appeals` (status + resolution_kind + admin_notes). Existing DB trigger handles review status, aggregate recompute, and notification inserts to both parties.
   - Also expose the intermediate-status `Select` (Pending / Waiting for Consent / Under Review / Waiting for Additional Evidence) as a small "Move to…" control above the radio group.

## 3. Data fetching additions
Extend the current `review_appeals` query to also select:
- `reviews:review_id(id, rating, comment, created_at, reviewer_id)`
- Join seller + buyer names via a follow-up `profiles.select("id, name, avatar_url").in("id", [...])` call
- Listing details via `transactions.select("id, listing_id, listings(title, price)").in("id", [...transactionIds])`

All done in `TrustPanel` `load()` (or a new `useAppealsQueue` hook) — no schema changes needed.

## 4. Files
- **New**: `src/components/admin/AppealsWorkspace.tsx` — KPI row + split view + detail panel.
- **New**: `src/components/admin/AppealDetailPanel.tsx` — disputed review + seller appeal + evidence gallery + chat audit box + resolution panel (inlines the current `ResolveAppealDialog` logic).
- **New**: `src/components/admin/EvidenceLightbox.tsx` — full-screen evidence viewer with keyboard nav.
- **Edit**: `src/components/admin/TrustPanel.tsx` — replace the entire `review-appeals` `TabsContent` body with `<AppealsWorkspace />`. Keep other tabs unchanged. Remove now-unused `ResolveAppealDialog` mount if it's fully absorbed into the detail panel (keep import if we still need the modal fallback — decide during build; default: absorb).

## 5. Out of scope
- No schema or trigger changes (existing notification/resolution triggers already do what's required).
- Reports, Account appeals, and Restricted tabs untouched.
- No changes to buyer/seller-facing appeal UI.

## Technical notes
- Reuse `RatingStars`, `useSignedUrl`, `formatRelative`, shadcn `Tabs`, `RadioGroup`, `Textarea`, `Badge`, `Dialog`.
- Resolution payload stays exactly compatible with the existing DB trigger to avoid regressions in notifications and review-status transitions.
- Split-view height mirrors verifications tab (`h-[calc(100vh-...)]`) so both admin views feel consistent.
