## Goal

Harden MPIN reset with a second factor (email OTP on top of the account password) and mask every MPIN entry so digits never render in plain text.

## 1. Forgot MPIN → password + email OTP

`src/components/mpin/ForgotMpinDialog.tsx` becomes a 3-step dialog:

```text
step 1: password   → re-authenticate (existing behaviour)
step 2: email OTP  → 6-digit code sent to the account email
step 3: new MPIN   → enter + confirm, then save
```

- On successful password check, immediately request a code with `supabase.auth.signInWithOtp({ email, shouldCreateUser: false })` and move to step 2. The account email comes from the signed-in session — never typed by the user.
- Step 2 verifies with `supabase.auth.verifyOtp({ email, token, type: "email" })`. Wrong/expired codes show an inline error and stay on the step.
- Resend link with a 30s cooldown, matching the existing `/verify-email` page.
- Only after the OTP verifies does step 3 appear and `set_mpin` become callable.
- Closing the dialog resets all steps and clears password, code, and PIN state.

Two new helpers in `src/hooks/use-mpin.tsx`: `sendResetOtp()` and `verifyResetOtp(code)`, both scoped to the current user's email, returning `{ error }` like the existing `reauthenticate`.

No database changes — Supabase's existing email OTP setup handles delivery.

## 2. Masked MPIN input

`src/components/mpin/MpinInput.tsx` renders each filled slot as a dot instead of the digit, by rendering a masked character overlay in place of the slot's character. Applies everywhere the component is used: MPIN setup, both confirm fields, the section unlock gate, and the reset flow's new-MPIN step.

- Filled slot shows ●, empty slots stay blank with the caret behaviour unchanged.
- Keeps numeric keyboard, paste, backspace, and `onComplete` working as today.
- Optional small "show/hide" eye toggle under the input so a user can reveal what they typed while setting it up — say the word if you'd rather have no reveal option at all.

## Technical notes

- The email OTP path is additive: password is still mandatory, so reset needs both factors.
- `signInWithOtp` re-issues a session for the same signed-in user; no account switch is possible since the email is read from the session.
- Masking is presentation-only; the raw value still flows to `verify_mpin` / `set_mpin` RPCs unchanged.
