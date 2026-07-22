## Problem

The **View full profile ↗** button inside `ProfilePeekDialog` is unresponsive. It currently uses `<Button asChild><Link to={`/seller/${id}`} onClick={() => onOpenChange(false)}>`. Radix Dialog closes on the same tick, unmounting the `<Link>` before React Router processes the click — so nothing happens.

## Fix

### 1. `src/components/inbox/ProfilePeekDialog.tsx`
- Replace the `Link`-based button with an imperative `useNavigate()` handler.
- Close the dialog first, then navigate on the next tick so the overlay tears down cleanly and doesn't lock scroll:
  ```ts
  const navigate = useNavigate();
  const handleView = () => {
    if (!profile?.id) return;
    onOpenChange(false);
    setTimeout(() => navigate(`/seller/${profile.id}`), 0);
  };
  ```
- Disable the button when `profile?.id` is missing (defensive guard).
- Keep the mini-listing `<Link>`s as-is but also switch them to `useNavigate` with the same close-then-navigate pattern to avoid the same class of bug.

### 2. No routing changes needed
- `/seller/:id` is already registered in `src/App.tsx` and `SellerPage.tsx` already renders the full profile (header, metrics, ratings summary, review list, listings). No new `/profile/:id` route needed — the existing seller page is the canonical public profile.

### 3. No other files touched
- `Inbox.tsx` already passes `peekId` (a valid `otherId` from `InboxRow`) so the userId guard is satisfied upstream; the in-component guard is added for safety.

## Out of scope
- Redesigning the full profile page (already exists at `/seller/:id`).
- Adding a separate `/profile/:id` route — would duplicate `SellerPage`.
