# Update IDAnalyzer API Key

## What to do
1. Use the secure secret-update form to replace `IDANALYZER_API_KEY` with the new value.
2. After the key is saved, verify the `scan-id` edge function can read it (tested via `supabase--curl_edge_functions` or a fresh deploy).
3. Confirm the key is no longer exposed in the frontend code or build.
4. Remind the user to revoke the old key in the IDAnalyzer dashboard.

## Notes
- Please enter the new key value in the secure form that will appear, not in the chat.
- No frontend code changes are required — the edge function already reads `Deno.env.get("IDANALYZER_API_KEY")`.
