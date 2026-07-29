# Anti-Fraud & Behavioral Monitoring Mechanism

A modular, rule-based detection layer that watches auth, MPIN, reports, listings, messages, and transactions, scores risk, and surfaces alerts to admins. No existing feature is modified — detection runs alongside current flows via DB triggers, an edge function, and a new admin tab.

## Data model (new tables only)

```text
behavior_events         one row per detected suspicious event
  id, user_id, category, event_type, severity (low|med|high),
  score_delta, description, ip, device, browser, session_id,
  metadata jsonb, created_at

behavior_alerts         aggregated open alerts for admin triage
  id, user_id, category, event_type, status (open|reviewing|dismissed|actioned),
  first_seen_at, last_seen_at, occurrences, notes, resolved_by, resolved_at

user_risk_scores        rolling fraud risk score per user
  user_id PK, score int, risk_level, alerts_count,
  last_event_at, under_review bool, updated_at

login_lockouts          progressive login lock state
  user_id PK (or email hash for pre-auth), failed_count, window_started_at,
  lock_level int, locked_until, updated_at

mpin_lockouts           progressive MPIN lock state
  user_id PK, failed_count, window_started_at,
  lock_level int, locked_until, updated_at
```

All tables: RLS on, admin read via `has_role(auth.uid(),'admin')`, users can read only their own `user_risk_scores` row (optional — default deny). Full GRANTs for `authenticated` + `service_role`.

## Detection rules

| # | Rule | Threshold | Action |
|---|------|-----------|--------|
| 1 | Failed login | 10 fails / 8 min rolling | Lock 10m → 20 → 40 → 80 … cap 24h. Reset on success. +10 score. |
| 2 | Failed MPIN | 10 fails / 8 min | Same doubling policy, cap 24h. Forgot-MPIN still allowed. +15. |
| 3 | Reporting abuse | >10/hr, >20/24h, many distinct targets, repeated rejected reports | Alert + mark under_review. +20. |
| 4 | Listing abuse | >20 listings/10 min, rapid edits, mass deletes, create-then-delete loops | Alert. +20. |
| 5 | Messaging spam | >50 msgs/min, identical body to many users, fan-out spikes | Alert. +20. |
| 6 | Transaction abuse | Excess cancels/disputes, burst volume, repeated same-counterparty pattern | Alert. +25. |

**Risk levels:** 0–29 Low, 30–59 Medium, 60–100 High. Never auto-suspend; only flag `under_review=true`.

## Server-side implementation

1. **`behavior-detect` edge function** — single entrypoint invoked by:
   - Client `signIn` wrapper (login pass/fail).
   - Client `verify_mpin` wrapper (MPIN pass/fail).
   - DB triggers `AFTER INSERT` on `review_reports`, `listings`, `messages`, `transactions` calling `pg_net` → this function (or a lightweight SQL evaluator — see fallback).
   
   Responsibilities: evaluate the relevant rule, upsert `*_lockouts`, insert `behavior_events`, upsert `behavior_alerts`, bump `user_risk_scores`, and emit an `audit_logs` entry via existing `append_audit_log` (categories `security.lockout`, `fraud.alert`).

2. **Fallback pure-SQL path**: for the 4 DB-trigger sources, ship a `SECURITY DEFINER` function `public.evaluate_behavior(_category, _user_id, _meta)` that does thresholds + upserts directly, so detection works without outbound HTTP. Edge function is used for login/MPIN where the caller is already client-side.

3. **Login/MPIN gating**:
   - `signIn`: before calling Supabase, RPC `check_login_lock(email)` → if locked, short-circuit with the remaining time.
   - `verify_mpin`: extend existing RPC to also consult `mpin_lockouts` (the current 5-attempt/15-min logic stays as inner guard, new table adds the rolling-window progressive layer around it — no behavior change on the happy path).

4. **Audit**: every lockout and every alert calls `append_audit_log` with the required fields (user, event type, score, level, ip, device, browser, session_id passed from client meta already used by `audit-log`).

## Client-side wiring (minimal, additive)

- `src/hooks/use-auth.tsx`: wrap `signIn` to call `check_login_lock` first and surface locked-message toast; no other flow change.
- `src/hooks/use-mpin.tsx`: same for `verify`; show remaining lock time from RPC response; keep Forgot MPIN path untouched.
- `src/lib/behavior.ts` (new): tiny helper to post client-observed context (ip is server-derived, device/browser/session come from existing audit helper).

## Admin dashboard

New tab **Behavior Monitoring** in `src/pages/Admin.tsx` (adjacent to Audit Logs).

Components under `src/components/admin/behavior/`:
- `BehaviorWorkspace.tsx` — split view (list + detail), mirrors AuditLogsWorkspace style.
- `RiskTable.tsx` — columns: Name, Email, Score, Level (colored badge), Alerts, Latest event, Time, Status. Filters: Low/Med/High, and per-category (Login, MPIN, Reporting, Messaging, Marketplace, Transaction). Search by name/email.
- `UserBehaviorDetail.tsx` — profile header, current score & level, timeline of `behavior_events`, list of open `behavior_alerts` with "Mark reviewing / Dismiss / Escalate to suspension" actions (suspension reuses existing `account_status` admin flow — no new suspension logic).

Data fetched via a new `admin-behavior` edge function (list/detail/resolve actions) — same pattern as `admin-audit`.

## Files to add / touch

Add:
- `supabase/migrations/<ts>_behavior_monitoring.sql` (tables, indexes, RLS, GRANTs, `evaluate_behavior`, triggers, `check_login_lock` RPC, extend `verify_mpin` wrapper).
- `supabase/functions/behavior-detect/index.ts`
- `supabase/functions/admin-behavior/index.ts`
- `src/lib/behavior.ts`
- `src/components/admin/behavior/BehaviorWorkspace.tsx`
- `src/components/admin/behavior/RiskTable.tsx`
- `src/components/admin/behavior/UserBehaviorDetail.tsx`

Touch (additive only):
- `src/hooks/use-auth.tsx` — pre-login lock check + post-fail notify.
- `src/hooks/use-mpin.tsx` — pre-verify lock check.
- `src/pages/Admin.tsx` — add "Behavior monitoring" tab.

## Guarantees

- No changes to KYC, marketplace CRUD, messaging, reviews/appeals, trust score, or existing audit chain semantics — only additive inserts via `append_audit_log`.
- All new tables have RLS + GRANTs and are admin-only by default.
- Progressive lockout uses a rolling window; a successful login/MPIN clears `failed_count` and `lock_level`.
- Risk score is advisory: only `under_review` flag is auto-set; suspensions remain manual admin actions.
