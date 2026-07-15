## Goal
Apply the same redesigned header + layout from `SellerPage.tsx` to the current user's own `Profile.tsx`, adapted for self-view.

## Changes to `src/pages/Profile.tsx`

Replace the existing cover-banner + stats-grid + tabs layout with the SellerPage structure:

1. **Header card** (rounded-3xl, gradient `from-primary-soft/60 via-card to-card`):
   - Avatar top-left (from `profile.avatar`)
   - Share icon top-right (uses `navigator.share`/clipboard fallback, same as SellerPage)
   - Name (`profile.name`), location with `MapPin`, bio/subtitle
   - Skill pills derived from `myListings` categories (fallback "Verified Seller")
   - 3-metric row: Rating (from `useUserRating`), Listings (`myListings.length`), Successful Transactions (new `useSellerTxStats(currentUserId)`)
   - Actions row — self-view variants:
     - Primary wide rounded button: **"Edit profile"** → `/settings` (replaces "Get in touch" since it's your own profile)
     - Circular icon button: **Plus** → `/sell` (replaces bookmark, since bookmarking yourself is meaningless)

2. **RatingsSummary** always visible below the header (same as SellerPage).

3. **Tabs** — keep the three existing self-profile tabs:
   - Your listings
   - Saved
   - Reviews (renders `UserReviewList`)
   Move them below `RatingsSummary` with `defaultValue="listings"`.

4. Constrain container to `max-w-3xl mx-auto space-y-5` to match SellerPage.

## Files
- edit `src/pages/Profile.tsx`
- reuse existing `useSellerTxStats`, `useUserRating`, `RatingsSummary`, `UserReviewList` — no new files.

## Out of Scope
- No changes to reviews logic, DB, or SellerPage.
