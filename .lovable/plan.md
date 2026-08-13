# Clear Disclosures for Deactivation & Deletion

Most of the machinery already exists (`account_lifecycle` states, listing archiving, hidden-seller filtering, RLS). This plan adds the disclosure wording, the missing duration options, an immediate-permanent-delete path, and a login restore prompt.

## 1. Deactivation

- Duration choices become: 7 days (1 week) and 30 days. The current 90-day and indefinite options are removed.
- Add a final "Deactivate Account?" confirmation step after MPIN + password with the disclosure text:
  "Your profile and active marketplace listings will be immediately hidden from public search, category feeds, and seller pages for [duration]. You can reactivate anytime by logging back in."
- On confirm: existing RPC sets state, `deactivated_at`, `reactivate_at`; then sign out with the toast "Account deactivated. Your profile and listings are hidden."

## 2. Deletion — two options

The delete dialog gains an option step (after identity checks) offering:

- **Delete immediately (permanent)** — disclosure:
  "PERMANENT DELETION DISCLOSURE: Your profile, avatar, personal verification data, and active listings will be immediately deleted. Historical transaction receipts will be anonymized ('Deleted User') for accounting/legal compliance. This action CANNOT be undone."
  Requires typing DELETE. Runs the same anonymization + storage purge the 30-day job already performs, but right now, then wipes the session and logs out.
- **Delete in 30 days (cancellable)** — disclosure:
  "30-DAY DELETION DISCLOSURE: Your profile and listings will be hidden from the public immediately. Your data will be permanently purged in 30 days. You can cancel this deletion anytime within the next 30 days simply by logging back in."
  Uses the existing `request_deletion` flow (hides profile, archives listings), then logs out.

## 3. Restore on login

- After sign-in, if the account is deactivated or pending deletion, a modal appears:
  "Welcome back! Your account is currently [deactivated / scheduled for deletion]. Would you like to restore your account and re-list your items?"
- Restore calls the existing reactivate / cancel-deletion RPCs (which un-archive listings) and shows a success toast; "Not now" keeps the existing persistent banner.

## 4. Visibility filter

- Verify and keep the current behaviour: feed, search, category views, saved items and item detail only show listings from active sellers and non-archived listings.
- `/seller/:id` and the chat profile peek for a non-active account render the fallback "This seller's account is currently unavailable."

## Technical notes

- Migration: allow `_days` of 7 or 30 only in `request_deactivation`; add a `delete_account_now()` path — anonymization runs in an authenticated edge function (`account-lifecycle-purge`) using the service role so storage files and the auth user can be removed immediately, reusing the purge logic from `account-lifecycle-cron`.
- Files touched: `src/components/account/DeactivateAccountDialog.tsx`, `src/components/account/DeleteAccountDialog.tsx`, `src/hooks/use-account-lifecycle.tsx`, a new `src/components/account/RestoreAccountDialog.tsx` mounted in `AppShell`, plus the migration and edge function.
- No changes to KYC, MPIN, messaging, transactions, or audit logging behaviour; every action stays audit-logged.
