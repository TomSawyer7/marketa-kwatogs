
-- Drop mutual handshake trigger
DROP TRIGGER IF EXISTS transactions_handshake_trg ON public.transactions;
DROP TRIGGER IF EXISTS transactions_handshake ON public.transactions;
DROP FUNCTION IF EXISTS public.transactions_handshake();

-- Replace UPDATE policy: only seller can update; buyer cannot
DROP POLICY IF EXISTS "Buyer confirms transaction" ON public.transactions;

CREATE POLICY "Seller updates transaction"
ON public.transactions
FOR UPDATE
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- Trigger: when seller flips status to completed, stamp confirmations
CREATE OR REPLACE FUNCTION public.transactions_seller_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
    NEW.seller_confirmed_at := COALESCE(NEW.seller_confirmed_at, now());
    NEW.buyer_confirmed_at := COALESCE(NEW.buyer_confirmed_at, now());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS transactions_seller_complete_trg ON public.transactions;
CREATE TRIGGER transactions_seller_complete_trg
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.transactions_seller_complete();

-- Ensure post-completion message trigger is attached with new copy
CREATE OR REPLACE FUNCTION public.transactions_post_completion_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.thread_id IS NOT NULL THEN
    INSERT INTO public.messages(thread_id, sender_id, body, kind, meta)
    VALUES (NEW.thread_id, NULL,
            'The seller has marked this transaction as completed. Please rate your experience!',
            'system',
            jsonb_build_object('transaction_id', NEW.id, 'event', 'completed'));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS transactions_post_completion_message_trg ON public.transactions;
CREATE TRIGGER transactions_post_completion_message_trg
AFTER UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.transactions_post_completion_message();
