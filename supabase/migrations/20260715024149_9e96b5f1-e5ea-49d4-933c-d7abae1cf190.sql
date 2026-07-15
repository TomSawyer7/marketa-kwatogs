
-- 1. Extend status CHECK constraint to include seller_completed and discussion (kept for compatibility)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check
  CHECK (status = ANY (ARRAY['proposed','agreed','pending_confirmation','seller_completed','completed','cancelled','discussion']));

-- 2. Replace UPDATE policies with role/state-scoped ones
DROP POLICY IF EXISTS "Seller updates transaction" ON public.transactions;
DROP POLICY IF EXISTS "Buyer confirms transaction" ON public.transactions;
DROP POLICY IF EXISTS "Seller marks as done" ON public.transactions;
DROP POLICY IF EXISTS "Buyer confirms completion" ON public.transactions;
DROP POLICY IF EXISTS "Buyer disputes completion" ON public.transactions;

CREATE POLICY "Seller marks as done"
ON public.transactions FOR UPDATE
USING (auth.uid() = seller_id AND status IN ('proposed','agreed','discussion'))
WITH CHECK (auth.uid() = seller_id AND status = 'seller_completed');

CREATE POLICY "Buyer confirms completion"
ON public.transactions FOR UPDATE
USING (auth.uid() = buyer_id AND status = 'seller_completed')
WITH CHECK (auth.uid() = buyer_id AND status = 'completed');

CREATE POLICY "Buyer disputes completion"
ON public.transactions FOR UPDATE
USING (auth.uid() = buyer_id AND status = 'seller_completed')
WITH CHECK (auth.uid() = buyer_id AND status IN ('proposed','agreed','discussion'));

-- 3. Rewrite BEFORE UPDATE trigger to stamp timestamps per transition
CREATE OR REPLACE FUNCTION public.transactions_seller_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'seller_completed' AND OLD.status IS DISTINCT FROM 'seller_completed' THEN
    NEW.seller_confirmed_at := COALESCE(NEW.seller_confirmed_at, now());
  END IF;
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.buyer_confirmed_at := COALESCE(NEW.buyer_confirmed_at, now());
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
    NEW.seller_confirmed_at := COALESCE(NEW.seller_confirmed_at, now());
  END IF;
  RETURN NEW;
END; $$;

-- 4. Rewrite AFTER UPDATE trigger to emit distinct system messages
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
  ELSIF OLD.status = 'seller_completed' AND NEW.status IN ('proposed','agreed','discussion') THEN
    INSERT INTO public.messages(thread_id, sender_id, body, kind, meta)
    VALUES (NEW.thread_id, NULL,
      'The buyer indicated the transaction is not yet complete.',
      'system',
      jsonb_build_object('transaction_id', NEW.id, 'event', 'buyer_disputed'));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS transactions_seller_complete_trg ON public.transactions;
CREATE TRIGGER transactions_seller_complete_trg
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.transactions_seller_complete();

DROP TRIGGER IF EXISTS transactions_post_completion_message_trg ON public.transactions;
CREATE TRIGGER transactions_post_completion_message_trg
AFTER UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.transactions_post_completion_message();
