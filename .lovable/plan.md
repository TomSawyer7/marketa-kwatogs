## Problem
`ProposalDialog` inserts `status: "proposed"`, but the DB check constraint only allows `pending_confirmation | completed | cancelled`. `TransactionHub` also references `"agreed"`. Result: insert fails with `transactions_status_check`.

## Fix
Align the DB constraint with the statuses the app actually uses across the proposal → agreement → completion flow.

### Migration
```sql
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('proposed','agreed','pending_confirmation','completed','cancelled'));
```

No frontend changes — existing `"proposed"`, `"agreed"`, `"completed"` values remain valid, and the `transactions_handshake` trigger still promotes to `completed` when both parties confirm.

## Out of scope
The user's step 4 (search fallback) isn't relevant here — the error is a failed insert in the chat, not a crash in user search. Search continues to work independently.
