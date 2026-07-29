
## Goal

Insert an 8-digit email OTP verification step immediately after signup, gating access to the existing KYC/verification flow. Nothing in the current ID/liveness/admin-review pipeline changes.

## Flow

```text
Sign up  →  /verify-email (8-digit OTP)  →  /verify (existing KYC)  →  /browse
```

- OTP delivery uses the already-configured Supabase Email OTP (SMTP) — no new edge functions or providers.
- Email confirmation status is read from `auth.users.email_confirmed_at` (already tracked by Supabase; no schema change needed).
- KYC (`verifications` table, liveness, admin review) is untouched.

## Changes

### 1. Signup (`src/hooks/use-auth.tsx`, `src/pages/Auth.tsx`)
- In `signUp`, keep `supabase.auth.signUp` but set `options.emailRedirectTo` to `${origin}/verify-email` and rely on Supabase to send the OTP email (template configured to send `{{ .Token }}`, 8 digits).
- Expose `emailVerified` in the auth context, derived from `user.email_confirmed_at`.
- Add `verifyEmailOtp(email, token)` → `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.
- Add `resendEmailOtp(email)` → `supabase.auth.resend({ type: 'signup', email })`.
- After successful signup, navigate to `/verify-email` (passing email in route state) instead of switching to the login tab.

### 2. New page `src/pages/VerifyEmail.tsx`
- Route added in `src/App.tsx` as a public route (before `VerificationGate` blocks it? — it must be reachable while logged in but unverified, so add it to `ALWAYS_ALLOWED` in `VerificationGate.tsx`).
- UI matches existing Auth/Verify pages: centered card on `bg-secondary/40`, Marketa logo, heading, description, 8-digit OTP input (shadcn `InputOTP` with `maxLength={8}`), Verify button, Resend link with 30s cooldown, "Change email" link back to `/auth`.
- On success: toast, then redirect to `/verify` (KYC) or requested `from` route.
- Handles error states (invalid/expired token, rate-limited resend).

### 3. Gating (`src/components/auth/VerificationGate.tsx`)
- Add new rule: if `user && !emailVerified && !isAdmin`, redirect everything except `/verify-email` and `ALWAYS_ALLOWED` to `/verify-email`. This runs before the existing KYC check, so unverified email users can't reach `/verify` either.
- Existing KYC gating (isVerified → `/verify`) remains unchanged and runs after email is confirmed.

### 4. Auth page redirect (`src/pages/Auth.tsx`)
- `destinationFor` updated: if `!emailVerified` → `/verify-email`, else fall through to existing verified/KYC logic.

## Supabase config note (user-side)

For the OTP email to contain an 8-digit numeric code (not a magic link), the Supabase **Confirm signup** email template must include `{{ .Token }}` and OTP length must be set to 8 in Auth → Providers → Email. The user has already configured SMTP; they may need to confirm the template uses `{{ .Token }}` and length is 8.

## Out of scope

- No changes to `verifications` table, KYC pages, admin dashboard, liveness, or edge functions.
- No new database migration.
- No new email provider integration.
