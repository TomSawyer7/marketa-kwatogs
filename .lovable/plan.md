## Goal

After KYC verification, every user sets a 6-digit MPIN. Entering Inbox, Add Listing, or Settings requires the MPIN once per section per browser session. Five wrong tries force the password-based reset flow.

## Database (new migration)

New table `public.user_mpins`:
- `user_id` (primary key, one MPIN per user)
- `mpin_hash` — bcrypt hash via pgcrypto, never plaintext
- `failed_attempts`, `locked_until`, timestamps

Access rules:
- The table is never readable by the browser (no select policy for users) — the hash never leaves the database.
- Users may only read a tiny "do I have an MPIN, am I locked out" status through a dedicated function.

Three security-definer functions:
- `mpin_status()` — returns `{ has_mpin, locked }` for the signed-in user.
- `set_mpin(_mpin)` — validates the code is exactly 6 digits, stores the bcrypt hash, resets attempt counters. Used for both first-time setup and reset.
- `verify_mpin(_mpin)` — compares against the hash, increments `failed_attempts` on failure, sets `locked_until` after 5 consecutive failures, clears counters on success. Returns `{ ok, attempts_left, locked }`. All counting happens server-side so it can't be bypassed from the client.

Note: `set_mpin` is only callable by an authenticated session, and the reset flow re-authenticates the password immediately before calling it.

## Frontend

**New: `src/hooks/use-mpin.tsx`** — provider holding MPIN status plus the set of sections unlocked in the current session (kept in `sessionStorage`, cleared on sign-out and on new browser session). Exposes `unlock(section)`, `isUnlocked(section)`, `verify`, `setMpin`, `refresh`.

**New: `src/pages/MpinSetup.tsx`** — route `/mpin-setup`. Six-digit OTP-style input, confirm-entry step, matching the app's existing verify pages.

**New: `src/components/mpin/MpinGate.tsx`** — wraps a route. If the section is already unlocked this session it renders children; otherwise it renders the page behind a blocking dialog asking for the 6-digit MPIN. Shows remaining attempts, and after 5 failures (or via the "Forgot MPIN?" link) switches to the reset flow.

**New: `src/components/mpin/ForgotMpinDialog.tsx`** — step 1: enter account password (re-authenticated against Supabase with the signed-in user's email); step 2: only on success, choose a new 6-digit MPIN. No email or OTP path is offered anywhere.

**`src/components/auth/VerificationGate.tsx`** — add one more stage after KYC: verified user without an MPIN is redirected to `/mpin-setup` (public/always-allowed routes and `/admin` unchanged).

**`src/App.tsx`** — register `/mpin-setup`; wrap `/inbox`, `/inbox/:id`, `/sell`, and `/settings` in `MpinGate` (inside `ProtectedRoute`). Mount `MpinProvider` under `AuthProvider`.

## Behaviour summary

```text
signup -> email OTP -> KYC -> MPIN setup -> marketplace
Inbox / Sell / Settings -> MPIN dialog (first visit each session)
5 wrong -> locked -> password re-entry -> new MPIN
```

## Technical notes

- Hashing uses `crypt(_mpin, gen_salt('bf'))` from pgcrypto; verification uses `crypt(_mpin, mpin_hash) = mpin_hash`.
- Password re-auth uses `supabase.auth.signInWithPassword` with the current user's email; the password is never stored or logged.
- MPIN inputs use the existing `InputOTP` component with numeric-only, masked entry.
- Admins bypass MPIN setup enforcement the same way they bypass KYC, but the gate still applies if they have an MPIN set.
