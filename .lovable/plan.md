# Secure Tamper-Resistant Audit Logging System

Adds a background audit trail with hash-chained integrity, an admin dashboard, and export tooling — without touching existing auth, KYC, marketplace, or trust logic.

## 1. Database (new migration, additive only)

New table `public.audit_logs`:

- `id uuid pk`, `seq bigserial unique` (chain order, gap detection)
- `timestamp timestamptz`, `created_at timestamptz`
- `user_id uuid`, `user_role text`, `session_id text`, `correlation_id uuid`
- `category text`, `action text`, `description text`
- `entity_type text`, `entity_id text`
- `ip_address inet`, `device text`, `browser text`, `operating_system text`
- `endpoint text`, `http_method text`, `status_code int`, `success bool`, `failure_reason text`
- `metadata jsonb` (sanitized; PII/secrets stripped)
- `previous_hash text`, `current_hash text` (SHA-256 hex)

Indexes: `(timestamp desc)`, `(user_id, timestamp)`, `(category, action)`, `(correlation_id)`, `(success)`, GIN on metadata.

RLS: admins read only (via `has_role`); no INSERT/UPDATE/DELETE grants to `anon`/`authenticated` — only `service_role` writes. UPDATE/DELETE revoked from everyone; a trigger raises on any UPDATE/DELETE as a second guard.

Chain: `SECURITY DEFINER` function `append_audit_log(payload jsonb)` runs inside a serializable transaction, takes an advisory lock, reads latest `current_hash`, computes `sha256(prev_hash || canonical_json(payload || seq || timestamp))`, inserts row. Only callable by `service_role`.

Verification function `verify_audit_chain(from_seq, to_seq)` recomputes hashes, returns `{ok, first_broken_seq, missing_seqs[]}`.

Additive `public.audit_categories` / `audit_actions` enums-as-text (no enum type to keep migrations cheap).

## 2. Logging service

New Edge Function `audit-log` (verify_jwt=false, validates JWT in code):

- Accepts a batch of events from the client, enriches with IP (from `x-forwarded-for`), UA parsing (browser/OS/device), role lookup, session id from JWT.
- Sanitizes payload: strips `password`, `mpin`, `otp`, `token`, `access_token`, `refresh_token`, `authorization` keys recursively.
- Calls `append_audit_log` per event under service role.
- Rate-limited per user to prevent flooding.

Second Edge Function `admin-audit` (admin-only):

- `list` with filters (date range, user, category, action, success, search), pagination, sorting.
- `get` single row.
- `verify` runs chain verification.
- `export` returns CSV / XLSX / PDF (server-side generation with `xlsx` + `pdf-lib` via npm: specifiers).

Server-side triggers write logs directly (bypassing HTTP) for DB-driven events:

- `AFTER INSERT` on `verifications`, `reviews`, `listings`, `transactions`, `messages`, `threads`, `review_appeals`, `account_lifecycle`, `user_roles`, `account_status` → trigger calls `append_audit_log` with a category/action derived from `TG_TABLE_NAME` + `TG_OP` + relevant columns. This captures profile updates, listing CRUD, transaction state changes, trust adjustments, appeals, role changes, suspensions — automatically, without touching app code.

## 3. Client-side capture (minimal, non-invasive)

New `src/lib/audit.ts` with `logEvent(category, action, meta?)` that:

- Debounces + batches events (2s / 20 events), stores queue in memory + `sessionStorage` for crash safety.
- Posts to `audit-log` edge function with the current access token.
- Fire-and-forget; failures never block UI.

Central hooks — small additions inside existing files (no behavior change):

- `use-auth.tsx`: log register, login success/failure, logout, password reset request/success, session expiration (via `onAuthStateChange`).
- `use-mpin.tsx`: log MPIN create/verify/success/failure, reset request/success.
- `VerifyEmail.tsx`: OTP sent/verified/failed.
- `ProtectedRoute.tsx` / `VerificationGate.tsx`: route access denial, unauthorized attempts.
- Admin actions in `Admin.tsx` / `admin-verification-action` / `TrustPanel` / appeal resolution: approvals, rejections, suspensions, manual trust adjustments (server-side trigger covers most; edge function adds admin-actor context).

Client hooks call `logEvent`; no existing logic changes.

## 4. Admin dashboard

New route `/admin/audit-logs` (added under existing Admin page as a new tab "Audit Logs" alongside Verifications and Trust & Safety, matching current design).

Components (new, under `src/components/admin/audit/`):

- `AuditFilters.tsx` — search bar, date range picker, user picker, category/action selects, success/failure toggle.
- `AuditTable.tsx` — responsive table: Timestamp, User, Event, Category, Status, IP, Device, Resource, Actions. Pagination, sorting, loading + empty states.
- `AuditDetailDialog.tsx` — modal with every field including `previous_hash`/`current_hash`/`seq`.
- `IntegrityVerifyDialog.tsx` — button "Verify Log Integrity", shows result banner ("Verified" / "Failed") and lists affected `seq` values.
- `ExportMenu.tsx` — CSV / Excel / PDF, respects current filters.

Uses existing shadcn primitives, tokens, and layout.

## 5. Security

- Only admins can call `admin-audit`; enforced by role check in the function.
- Audit table has zero UI-driven UPDATE/DELETE paths; DB triggers raise on any modification.
- Exports sanitize the same fields as ingestion.
- Log injection protection: all string fields length-capped, control chars stripped, no template interpolation into HTML in dashboard (React handles escaping).
- No secrets (`password`, `mpin`, `otp`, tokens) ever accepted into `metadata`.

## Technical details

- Hash: `sha256(previous_hash + '|' + seq + '|' + canonical_json_sorted(row_minus_hashes))` — canonical JSON with sorted keys ensures deterministic recomputation.
- Genesis hash: `'0'.repeat(64)` for `seq = 1`.
- Concurrency: `pg_advisory_xact_lock(hashtext('audit_logs_chain'))` inside `append_audit_log` serializes chain writes; batching amortizes lock cost.
- UA parsing via `ua-parser-js` (npm: specifier in Deno).
- Exports: `xlsx` (SheetJS) for CSV+XLSX, `pdf-lib` for PDF.
- Zero changes to existing tables, RLS policies, or functions.

## Out of scope

- Backfill of historical events (chain starts from deployment).
- External SIEM shipping (can be added later behind the same service).

## Files

New:
- `supabase/migrations/<ts>_audit_logs.sql`
- `supabase/functions/audit-log/index.ts`
- `supabase/functions/admin-audit/index.ts`
- `src/lib/audit.ts`
- `src/components/admin/audit/{AuditFilters,AuditTable,AuditDetailDialog,IntegrityVerifyDialog,ExportMenu}.tsx`
- `src/pages/AdminAuditLogs.tsx` (or new tab section inside `Admin.tsx`)

Edited (log calls only, no behavior change):
- `src/hooks/use-auth.tsx`, `src/hooks/use-mpin.tsx`
- `src/pages/VerifyEmail.tsx`
- `src/components/auth/ProtectedRoute.tsx`, `src/components/auth/VerificationGate.tsx`
- `src/pages/Admin.tsx` (add tab)
