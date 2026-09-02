# Update the OCR API key (and stop shipping it in the browser)

The IDAnalyzer key is currently written directly into the front-end file that scans IDs, so it is visible to anyone who opens the site. That is very likely why the quota drained. Swapping in a new hardcoded key would repeat the problem, so the key moves to a secure server-side secret at the same time.

## What changes for users

Nothing visible. Uploading front/back of an ID, reviewing extracted details, and confirming works exactly as today.

## Approach

1. Store the new IDAnalyzer key as a backend secret named `IDANALYZER_API_KEY` (entered through the secure form — never in code).
2. Add a new edge function `scan-id` that:
   - requires a signed-in user,
   - accepts the front/back images as base64,
   - calls `https://api2.idanalyzer.com/scan` with the key from the environment,
   - returns the same normalized field object the UI already expects.
3. Update `src/components/verify/IDVerification.tsx` to call the edge function instead of IDAnalyzer directly. The extraction/QR-parsing logic (field mapping, barcode fallback, `qr_payload`) moves into the function unchanged so results stay identical.
4. Remove the hardcoded `API_KEY` constant from the front-end.

## Technical notes

- New file: `supabase/functions/scan-id/index.ts`, with CORS headers and JWT verification enabled (default), invoked via `supabase.functions.invoke("scan-id", ...)`.
- Base64 conversion of the two files stays client-side; the payload is posted to the function.
- Error shape preserved: quota/API errors surface as the same toast message in the UI.
- The old key should be revoked in the IDAnalyzer dashboard after the switch, since it is in the public bundle and in git history.

## Follow-up needed from you

After approval I will open the secure secret form for `IDANALYZER_API_KEY` — paste the new key there.
