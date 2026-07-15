## Verified Two-Way Ratings & Reviews — App Store style

Redesign the reviews surface on `SellerPage` to match the App Store layout, and tighten the write-review guardrails so ratings are only ever generated from a completed transaction, once per party, within a fixed window.

### 1. UI changes (frontend only)

**New component `src/components/reviews/RatingsSummary.tsx`**
- Large aggregate score ("4.8") + "out of 5"
- Total count ("894 Ratings")
- 5→1 star horizontal distribution bars (computed client-side from fetched reviews)
- "Tap to Rate" star row + "Write a Review" button
  - Locked by default; enabled only when the viewer has an eligible transaction token (see logic below)
  - Locked state shows message: *"You can only rate users you have successfully transacted with."*

**Update `src/components/reviews/UserReviewList.tsx`**
- Card layout inspired by App Store: bold title (auto-derived from first tag, e.g. "Helpful"), star row, `1y ago · Reviewer Name`, body text with **Read more / Read less** toggle (truncate ~180 chars)
- Sort dropdown: **Most Recent**, **Most Helpful** (highest rating, then longest comment), **Highest**, **Lowest**
- Keep existing report action

**Wire into `SellerPage.tsx`**
- Replace current "Reviews" tab content with `RatingsSummary` on top + filtered `UserReviewList` below
- Move avg-rating chip in header to reuse the same hook

**Design language**
- Dark-card look matching reference: `bg-card` rounded-2xl, muted bar tracks (`bg-muted`) with `bg-foreground` fills, `text-primary` accents on active stars and "Tap to Rate" and sort control (kept theme-token based, no hardcoded colors)

### 2. Guardrail logic (uses existing schema — no migration)

The `transactions` and `reviews` tables already model this. We formalize the rules on the client:

```
canReview(viewer, profileOwner) =
  exists tx in transactions where
    tx.status == 'completed'
    AND ((tx.buyer_id == viewer AND tx.seller_id == profileOwner)
      OR (tx.seller_id == viewer AND tx.buyer_id == profileOwner))
    AND tx.confirmed_at >= now() - REVIEW_WINDOW_DAYS
    AND NOT exists review where
        review.transaction_id == tx.id AND review.reviewer_id == viewer
```

- `REVIEW_WINDOW_DAYS = 14` (constant in `src/lib/reviews.ts`)
- Query runs on profile load; returns the eligible `transaction_id` + role (buyer/seller)
- If eligible → unlock "Tap to Rate" / "Write a Review", pass token into existing `ReviewForm`
- If not eligible → disabled state with tooltip explaining the reason (no tx, expired, already reviewed)
- Existing DB constraints (`reviews` unique on `transaction_id, reviewer_id`, and RLS requiring completed tx) remain the source of truth server-side; UI just mirrors them

### 3. Deliverables per user request

**Component schema** (documented in a short block inside `RatingsSummary.tsx`):
```
RatingsSummary
├── AggregateHeader  { avg, count }
├── DistributionBars { counts[1..5] }
├── TapToRate        { locked, onRate }
└── WriteReviewCTA   { locked, lockReason, onOpenForm }

ReviewCard
├── Title       (derived from top tag)
├── Stars       (1–5)
├── Meta        { relativeTime, reviewerName }
└── Body        { text, truncated, onToggle }

ReviewList
└── SortControl { Most Recent | Most Helpful | Highest | Lowest }
```

**DB logic** — no schema change; reuse existing tables. Eligibility pseudocode above will live in a new hook `useReviewEligibility(profileOwnerId)` in `src/hooks/use-review-eligibility.ts`.

### Files touched
- new: `src/components/reviews/RatingsSummary.tsx`
- new: `src/hooks/use-review-eligibility.ts`
- edit: `src/components/reviews/UserReviewList.tsx` (App Store card + sort + read more)
- edit: `src/pages/SellerPage.tsx` (compose summary + list)
- edit: `src/lib/reviews.ts` (add `REVIEW_WINDOW_DAYS`)

Scope stays frontend + one read-only hook; no migrations, no backend changes.
