DROP POLICY IF EXISTS "Participants cancel transaction" ON public.transactions;
CREATE POLICY "Participants cancel transaction"
ON public.transactions FOR UPDATE
TO authenticated
USING (auth.uid() IN (buyer_id, seller_id) AND status IN ('proposed','agreed','discussion','seller_completed'))
WITH CHECK (auth.uid() IN (buyer_id, seller_id) AND status = 'cancelled');

CREATE OR REPLACE FUNCTION public.transactions_post_completion_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.thread_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status = 'seller_completed' AND OLD.status IS DISTINCT FROM 'seller_completed' THEN
    INSERT INTO public.messages(thread_id, sender_id, body, kind, meta)
    VALUES (NEW.thread_id, NULL,
      'The seller has marked this transaction as completed. Did you receive your item/service?',
      'system',
      jsonb_build_object('transaction_id', NEW.id, 'event', 'seller_completed'));
  ELSIF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.messages(thread_id, sender_id, body, kind, meta)
    VALUES (NEW.thread_id, NULL,
      'Transaction successfully completed! You can now rate each other.',
      'system',
      jsonb_build_object('transaction_id', NEW.id, 'event', 'completed'));
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    INSERT INTO public.messages(thread_id, sender_id, body, kind, meta)
    VALUES (NEW.thread_id, NULL,
      'This transaction was cancelled.',
      'system',
      jsonb_build_object('transaction_id', NEW.id, 'event', 'cancelled'));
  ELSIF OLD.status = 'seller_completed' AND NEW.status IN ('proposed','agreed','discussion') THEN
    INSERT INTO public.messages(thread_id, sender_id, body, kind, meta)
    VALUES (NEW.thread_id, NULL,
      'The buyer indicated the transaction is not yet complete.',
      'system',
      jsonb_build_object('transaction_id', NEW.id, 'event', 'buyer_disputed'));
  END IF;
  RETURN NEW;
END; $$;