# Account Deactivation & Deletion

Two distinct, clearly separated features in Settings, backed by one state table, RLS-based hiding, and a nightly scheduled job.

## 1. Database

New table `public.account_lifecycle` (one row per user):
- `user_id` (PK), `state` (`active` | `deactivated` | `pending_deletion` | `deleted`)
- `deactivated_at`, `reactivate_at` (null = indefinite)
- `deletion_requested_at`, `delete_after` (requested + 30 days)
- `created_at`, `updated_at` + touch trigger
- Grants: `authenticated` (own row read/write via RLS scoped to `auth.uid()`), `service_role` all. No `anon`.

Helper function `public.is_account_hidden(_user_id uuid)` — `stable security definer`, returns true when state is `deactivated` or `pending_deletion`.

RLS changes for marketplace hiding:
- `listings` public SELECT policy becomes `NOT is_account_hidden(seller_id)` (owner and admins still see their own).
- `profiles` public SELECT policy becomes `NOT is_account_hidden(id)`; owner/admin policies unchanged so the user can still use Settings.
- Threads/messages/transactions untouched — existing counterparties keep their history.

Audit table `public.account_deletion_log`: `id`, `deleted_at`, `grace_started_at`, `had_kyc boolean`. No personal data, no user id link to a live person beyond the anonymized placeholder id. Admin-read only.

RPCs (security definer, all validate `auth.uid()`):
- `request_deactivation(_days int | null)` — sets state and `reactivate_at`.
- `reactivate_account()` — clears deactivation, sets `active`.
- `request_deletion()` — sets `pending_deletion`, `delete_after = now() + 30 days`.
- `cancel_deletion()` — back to `active`.
Client verifies MPIN/password/OTP before calling these (see below); the RPCs additionally require a fresh MPIN verification token check via `verify_mpin` result passed in as an argument, so they can't be called bare from the console.

## 2. Verification gates (reuse existing primitives)

- Deactivate: `verify_mpin` RPC + `signInWithPassword` re-auth (existing `reauthenticate` in `use-mpin`). No OTP.
- Delete: MPIN + password + 8-digit email OTP using the exact existing Forgot-MPIN path (`supabase.auth.reauthenticate()` to send, `verify_mpin_reset_otp` RPC to check) so the session is never replaced.

## 3. Settings UI

New section "Account management" at the bottom of `src/pages/Settings.tsx`, two visually distinct cards:
- **Deactivate (amber/neutral)** — explains: profile and listings hidden, nothing deleted, reversible any time. Duration select: 7 / 30 / 90 days / Indefinite. Opens `DeactivateAccountDialog` (MPIN → password → confirm).
- **Delete permanently (destructive)** — explains: 30-day grace period, then personal data anonymized and KYC/liveness files erased; transaction history is retained under "Deleted User". Opens `DeleteAccountDialog` (MPIN → password → email OTP → typed "DELETE" confirmation).

New components: `src/components/account/DeactivateAccountDialog.tsx`, `DeleteAccountDialog.tsx`, `AccountLifecycleBanner.tsx`.

## 4. Login-time prompts

New hook `use-account-lifecycle.ts` + a banner rendered in `AppShell`:
- `deactivated` → "Your account is deactivated until {date}. Reactivate now?" with a one-click reactivate button.
- `pending_deletion` → countdown "Your account will be permanently deleted in N days" + "Cancel deletion request".
Deactivated / pending-deletion users can still sign in and reach Settings; other marketplace routes show the banner with the reactivate call to action.

## 5. Scheduled processing

Edge function `supabase/functions/account-lifecycle-cron/index.ts` (service role, no JWT trust — protected by a shared `CRON_SECRET` header):
1. Auto-reactivate: rows with `state='deactivated'` and `reactivate_at <= now()` → `active`.
2. Finalize deletion: rows with `state='pending_deletion'` and `delete_after <= now()`:
   - Anonymize `profiles`: name → `Deleted User`, first/last name, email, bio, location, avatar_url → null; mark `is_verified=false`.
   - Delete rows from `verified_users` and `verifications` (all extracted KYC/OCR fields), and `user_mpins`.
   - Remove storage objects for that user from `id-documents`, `liveness-media`, `avatars`, `appeal-evidence`.
   - Anonymize auth user email/phone via admin API (`admin.updateUserById` to a non-routable placeholder) and ban the account; **do not** delete the auth user, so all FKs on transactions/reviews/threads stay intact.
   - Keep `listings`, `transactions`, `reviews`, `messages` rows as-is, now attributed to the placeholder profile.
   - Set state `deleted`, insert one `account_deletion_log` row.

Scheduled daily via `pg_cron` + `pg_net` (`select cron.schedule(...)` run through the insert tool, since it embeds the project URL and key).

## Integrity notes

Nothing is hard-deleted from the relational history — only the raw files and identifying fields. Counterparties keep full transaction/order/review records; those records now display "Deleted User". `CRON_SECRET` will be added as a secret before the function is written.
