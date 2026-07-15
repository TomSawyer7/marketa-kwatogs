
DROP POLICY IF EXISTS "Seller creates transaction for own listing" ON public.transactions;

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
