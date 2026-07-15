## Fix: RLS blocks buyers from creating a proposal

The existing `transactions` INSERT policy only lets the listing's seller insert a row. When a buyer clicks "Create Proposal" in a chat, PostgREST returns "new row violates row-level security policy for table transactions".

## Migration

Replace that policy with one that lets either party (buyer or seller) create a transaction, while still preventing spoofing:

```sql
DROP POLICY "Seller creates transaction for own listing" ON public.transactions;

CREATE POLICY "Participants create transaction"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = buyer_id OR auth.uid() = seller_id)
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = transactions.listing_id
        AND l.seller_id = transactions.seller_id
    )
    AND (
      thread_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.threads t
        WHERE t.id = transactions.thread_id
          AND (auth.uid() = t.user_a OR auth.uid() = t.user_b)
          AND transactions.buyer_id  IN (t.user_a, t.user_b)
          AND transactions.seller_id IN (t.user_a, t.user_b)
      )
    )
  );
```

Guarantees:
- Inserter must be one of the two parties on the row.
- `seller_id` must match the listing's real seller (buyer can't rewrite ownership).
- If linked to a thread, both parties on the transaction must be the thread participants.

## Frontend
No changes. Existing `ProposalDialog` already sets `seller_id = listing.seller_id`, `buyer_id = the other user`, and `thread_id = current thread`.

## Out of scope
Existing UPDATE policy is fine (already allows both parties).
