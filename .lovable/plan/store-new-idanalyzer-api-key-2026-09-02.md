# Store New IDAnalyzer API Key

## What to do
1. Store the user-provided IDAnalyzer API key as the backend secret `IDANALYZER_API_KEY` (used by the already-deployed `scan-id` edge function).
2. Verify the `scan-id` function picks it up (test invoke — expect an auth-gated response, not a missing-secret error).
3. Remind the user to revoke the old exposed key in the IDAnalyzer dashboard.

## Notes
- The key never ships to the browser; only the edge function reads it via `Deno.env.get("IDANALYZER_API_KEY")`.
- No code changes needed — the edge function and frontend wiring are already in place.
