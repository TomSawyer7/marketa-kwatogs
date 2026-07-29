Plan to fix the Forgot MPIN flow:

1. Update the MPIN reset flow order
   - Change the dialog sequence from `password → OTP → new MPIN` to `send OTP → OTP input → password confirmation → new MPIN`.
   - Keep the existing 8-digit OTP input UI and resend-code behavior.
   - Keep password confirmation required before `set_mpin` is allowed.

2. Fix the Supabase Auth OTP call
   - Update the Forgot MPIN email trigger in `src/hooks/use-mpin.tsx` so it mirrors the registration verification pattern as closely as Supabase allows for an existing user.
   - Continue verifying with `supabase.auth.verifyOtp({ email, token, type: "email" })` so the entered 8-digit code is verified by Supabase Auth, not only by the client.
   - Avoid any redirect-driven/magic-link behavior in the app flow.

3. Update the email-template source for this OTP flow
   - The current MPIN reset email is produced by `signInWithOtp`, which uses Supabase’s Magic Link email template for existing users.
   - I’ll add/update the project’s auth email template source so the Magic Link template displays `{{ .Token }}` as an 8-digit code and removes the “Log In” link/button, styled consistently with the registration OTP email.
   - If the connected Supabase project requires dashboard-side template activation, I’ll include the exact dashboard setting that must match: Magic Link template body must show `{{ .Token }}`, not `{{ .ConfirmationURL }}`.

4. Validate the flow
   - Confirm the UI starts by sending the OTP, shows an 8-digit code input, verifies the code server-side, then asks for the account password, then allows the new masked MPIN to be saved.
   - Ensure this does not affect KYC, identity verification, marketplace access, or normal password reset flows.