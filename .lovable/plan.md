# Fix Account Deactivation & Deletion Visibility

## Current state (verified)

- Account state already lives in `account_lifecycle` (`state`: active / deactivated / pending_deletion / deleted, plus `deactivated_at`, `reactivate_at`, `deactivation_days`, `deletion_requested_at`, `delete_after`), written by the `request_deactivation`, `request_deletion`, `reactivate_account`, `cancel_deletion` functions.
- RLS on `profiles` and `listings` already hides rows via `is_account_hidden(...)`, so hidden sellers should already drop out of feeds.
- Gaps that break the experience: deactivation/deletion do not sign the user out, the marketplace store also merges hard-coded seed listings that never get filtered, `/seller/:id` renders a normal (empty) profile instead of an "unavailable" state, and there is no reactivate prompt on login.

Rather than adding a duplicate `status` column to `profiles` (two sources of truth that can drift), the plan keeps `account_lifecycle` as the single source and exposes the state where the UI needs it.

## What will change

### 1. Database
- Add a lightweight, read-only view/column exposure so the frontend can ask "is this account hidden?" for a specific profile (`is_account_hidden` is already there; a `profiles`-facing helper RPC will be added for the seller/profile pages).
- On deletion request: mark the user's listings as hidden immediately (soft archive flag on `listings`) so they vanish even for cached clients, and keep them out of every feed.
- Fix `reactivate_at` handling so an expired deactivation flips back to active on next login, in addition to the existing cron.

### 2. Deactivation flow
- After a successful deactivation, sign the user out and show: "Your account is deactivated and will be hidden until <date>" (or "until you reactivate it" for indefinite).

### 3. Deletion flow
- After a successful deletion request, archive the user's listings, sign out, and revoke the session. Keep the existing 30-day grace period and cron finalization.

### 4. Feed / search filtering
- Marketplace store: filter listings by seller lifecycle state client-side as a safety net on top of RLS, and drop seed listings for hidden sellers.
- Applies to Browse, Landing, category filters, Saved, and item detail.

### 5. Profile / seller pages
- `/seller/:id` (and profile peek in chat): when the target account is deactivated or scheduled for deletion, skip listings and contact info and render "This account is temporarily deactivated or unavailable."

### 6. Reactivation on login
- On sign-in, if the account is deactivated: auto-reactivate when `reactivate_at` has passed; otherwise prompt "Your account is currently deactivated. Would you like to reactivate it now?" with reactivate / sign-out choices.
- Users pending deletion keep the existing cancel-deletion banner.

## Technical notes

- Files touched: `src/store/marketa.tsx`, `src/hooks/use-account-lifecycle.tsx`, `src/hooks/use-auth.tsx`, `src/components/account/DeactivateAccountDialog.tsx`, `src/components/account/DeleteAccountDialog.tsx`, `src/pages/SellerPage.tsx`, `src/components/inbox/ProfilePeekDialog.tsx`, plus one migration.
- No changes to KYC, MPIN, messaging, transactions, or audit logging behaviour.
