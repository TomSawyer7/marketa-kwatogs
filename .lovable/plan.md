## Goal
Switch the Forgot Password flow from magic-link recovery to 8-digit email OTP verification, matching the new Supabase `{{ .Token }}` template. Keep login, registration, email verification, MPIN, KYC, and all other flows untouched.

## New user flow

```text
/forgot-password  →  enter email, request OTP
        ↓
/verify-reset-password  →  enter 8-digit code (resend w/ 60s cooldown)
        ↓
/create-new-password  →  set + confirm new password
        ↓
/auth  (success toast, signed out)
```

## Changes

1. **`src/pages/ForgotPassword.tsx`**
   - Send OTP via `supabase.auth.resetPasswordForEmail(email)` (no `redirectTo`, so Supabase emails the token only).
   - On success, store the email in `sessionStorage` (`marketa.reset.email`) and navigate to `/verify-reset-password`.
   - Update copy: "we'll email you an 8-digit code".

2. **`src/pages/VerifyResetPassword.tsx`** (new)
   - Read email from `sessionStorage`; if missing, redirect to `/forgot-password`.
   - 8 separate numeric input boxes: auto-focus, auto-advance, backspace to previous, numeric-only, paste splits across boxes, responsive.
   - Submit: `supabase.auth.verifyOtp({ email, token, type: "recovery" })`. On success, mark `sessionStorage["marketa.reset.verified"] = "1"` and navigate to `/create-new-password`.
   - Resend button: calls `resetPasswordForEmail` again, then disables for 60s with visible countdown.
   - Errors: invalid code, expired code, network — surfaced via inline text + `toast.error`.

3. **`src/pages/CreateNewPassword.tsx`** (new)
   - Guard: requires the recovery session (from `verifyOtp`) AND the `marketa.reset.verified` flag; otherwise redirect to `/forgot-password`.
   - Reuse the existing password rules + confirm-match validation from `ResetPassword.tsx`.
   - On submit call `updatePassword` (existing hook), then `signOut`, clear session flags, toast success, navigate to `/auth`.

4. **`src/App.tsx`**
   - Register the two new public routes: `/verify-reset-password` and `/create-new-password`.
   - Keep `/reset-password` route for backwards compatibility (harmless) OR remove it — see Open questions.

5. **`src/components/auth/VerificationGate.tsx`**
   - Add `/verify-reset-password` and `/create-new-password` to `ALWAYS_ALLOWED` so an authenticated-but-recovering session isn't bounced into KYC.

6. **`src/hooks/use-auth.tsx`**
   - Leave `resetPassword` signature intact but drop the `redirectTo` option (token-only email). `updatePassword` unchanged.

## Not changed
- Registration email verification, MPIN reset OTP, KYC, admin flows, `use-auth` public API surface.
- Supabase templates/config (already updated by the user).

## Open questions
- Keep `/reset-password` (legacy link handler) as a redirect to `/forgot-password`, or delete it entirely? Default: keep it as a redirect for any stale emails in transit.
