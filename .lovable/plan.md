

## Goal
Fix the verify-id-ocr edge function so extracted ID fields display as clean values (not raw JSON arrays) by mirroring your working test app's IDAnalyzer v2 integration.

## Root cause
IDAnalyzer v2 `/scan` returns each field as `[{value, confidence, source}, ...]` (an array of detection objects), not plain strings. The current edge function passes those arrays straight into the DB, so the Verify screen renders the raw JSON. Several v2 field names (e.g. `birthDate`, `sex`) are also missing from the lookup list, which is why DOB and Gender are blank.

## What we'll do (after you approve)

1. **Unzip and read your working app**
   Extract `Marketplace_Verification_System.zip` to inspect `app.js`, `index.html`, `style.css` and copy:
   - The exact endpoint, profile, and request body shape you call
   - The exact response field names and the unwrap logic you use
   - Any pre/post-processing (resize, JPEG compress, base64 strip)

2. **Rewrite `supabase/functions/verify-id-ocr/index.ts`**
   - Add a `valueOf()` helper that handles all three shapes: plain string, `{value}`, and `[{value}, ...]` (picks highest-confidence entry).
   - Expand field lookups to cover v2 names: `firstName`/`given_name`, `lastName`/`surname`, `documentNumber`, `birthDate`/`dob`, `sex`/`gender`, `nationality`, `address1`/`address`, `placeOfBirth`, `issued`/`dateOfIssue`, etc.
   - Match the request shape (profile + base64) to your working app's call so extraction quality matches what you saw working.
   - Keep storing the raw IDAnalyzer JSON in a debug log line so we can verify field names in function logs.

3. **Patch the Verify screen render**
   Defensive fallback in `src/pages/Verify.tsx` so even if a stored value is a stringified array, it renders as text (prevents the `[{"value":"…"}]` UI bug from recurring on old rows).

4. **Redeploy & test**
   - Deploy `verify-id-ocr`.
   - You retry Step 1; we read the function logs to confirm clean extraction.
   - Verify the screen shows: Full name, DOB, Gender (Sex), Document number, Address — all as plain text.

## Files changed
- `supabase/functions/verify-id-ocr/index.ts` (rewrite OCR parsing)
- `src/pages/Verify.tsx` (defensive render of OCR fields)

## Out of scope
- Step 2 liveness (unchanged, per your earlier decision)
- Admin UI changes (already shows the rich fields)
- DB schema (no migration needed — columns already exist)

