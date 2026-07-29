## What's actually wrong

The reset dialog already calls `signInWithOtp`, which is the same Supabase OTP mechanism registration uses. The email you received is a link because Supabase renders a **different template** for this call: existing-user OTP emails use the **Magic Link** template, while registration used the **Confirm signup** template (which you already edited to print `{{ .Token }}`). The Magic Link template is still the stock "Follow this link to login" markup, so a link goes out instead of a code.

So the fix is two parts: one dashboard template change, one code change.

## 1. Dashboard (one-time, you do this)

In Supabase → Authentication → Email Templates → **Magic Link**, replace the body with a token-based version, mirroring the Confirm signup template:

```html
<h2>Your Marketa verification code</h2>
<p>Enter this code to continue:</p>
<h1>{{ .Token }}</h1>
<p>This code expires in 1 hour and can be used once.</p>
```

Token length is a single project-wide setting (Authentication → Providers → Email → OTP length), already 8 for registration, so this code is 8 digits automatically — same generation, same expiry, same verification path.

## 2. Code change

`src/components/mpin/ForgotMpinDialog.tsx`:
- Change `OTP_LENGTH` from 6 to 8 so the reset step matches registration exactly.
- Widen the OTP row layout for 8 slots (smaller slot width so it fits the dialog on mobile).
- Keep the flow order unchanged: password → 8-digit email OTP → new MPIN.

`src/hooks/use-mpin.tsx`:
- `sendResetOtp` / `verifyResetOtp` stay as they are — `signInWithOtp({ shouldCreateUser: false })` + `verifyOtp({ type: "email" })` is the identical pair `/verify-email` uses.

No database or edge function changes.

## Note

Until the Magic Link template is updated in the dashboard, the reset email will keep arriving as a link no matter what the app code does — the template controls what's rendered.
