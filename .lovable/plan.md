## Goal
Redesign the seller profile header (SellerPage) to match the uploaded card reference, and refine the ratings section below it. Transaction-locked review logic already exists — keep and reuse it.

## 1. New Profile Header (`src/pages/SellerPage.tsx`)

Replace the current banner+avatar header with a single rounded card, soft gradient background (light blue → white), containing:

```text
┌─────────────────────────────────────────────┐
│  [Avatar]                          [Share] │
│                                             │
│  Name (bold, 2xl)                           │
│  Location (muted, sm)                       │
│  Role / "Verified Seller" (muted, xs)       │
│                                             │
│  [ Figma ] [ UX Design ]  ← skill pills     │
│                                             │
│  ★ 4.8      34         128                  │
│  Rating   Listings   Successful Txns        │
│                                             │
│  [ Get in touch ─────────────── ] [ 🔖 ]    │
└─────────────────────────────────────────────┘
```

Details:
- Avatar top-left (h-16 w-16, ring-2 ring-background).
- Share icon (lucide `Share`) top-right, ghost icon button.
- Name (text-2xl font-bold), location under name with `MapPin` icon, role sub-text under location.
- Skill/tag pills from seller categories (fallback to `Verified`, `Trusted Seller` if none). Rounded-full, muted bg.
- 3-column metric row (grid-cols-3, dividers optional):
  - Rating: `★ {avg}` from `useUserRating` (fallback `—`), sub-label "Rating"
  - Listings: `sellerListings.length`, sub-label "Listings"
  - Successful Transactions: count from `transactions` where seller_id=seller.id AND status='completed' (new small hook `useSellerTxStats`)
- Primary actions row: wide rounded `Get in touch` button (links to messages/contact — reuse existing route if any, else placeholder handler) + circular bookmark IconButton (toggle local state).

## 2. Ratings Section Below Header

Keep existing `RatingsSummary` + `UserReviewList` inside the Reviews tab. Two small tweaks:
- Move `RatingsSummary` out of the tab so aggregate is always visible directly under the header card; keep review list inside Tabs (Listings / Reviews) as today.
- No behavior change to `useReviewEligibility` — Tap-to-Rate and Write a Review stay locked/hidden unless the viewer has a `completed` transaction with the profile owner. Already implemented.

## 3. New Small Hook

`useSellerTxStats(sellerId)` in `src/hooks/use-seller-tx-stats.ts`:
- Queries `transactions` filtered by `seller_id = sellerId, status = 'completed'`, returns `{ successfulCount }`.

## 4. Design Tokens

Use existing tokens (`bg-card`, `border-border`, `text-muted-foreground`, `text-primary`). Header card background: `bg-gradient-to-br from-primary-soft/40 to-card`. No hardcoded colors.

## Files
- edit `src/pages/SellerPage.tsx` — new header layout, metrics row, actions
- add `src/hooks/use-seller-tx-stats.ts`
- (no changes to review components, eligibility hook, or DB)

## Out of Scope
- No schema changes, no new tables.
- No changes to `Profile.tsx` (own profile) unless you want it mirrored — ask if needed.
