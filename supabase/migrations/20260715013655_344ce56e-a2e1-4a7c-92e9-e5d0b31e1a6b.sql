
-- ============ threads ============
CREATE TABLE public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  listing_id uuid NULL REFERENCES public.listings(id) ON DELETE SET NULL,
  transaction_id uuid NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT threads_pair_order CHECK (user_a < user_b)
);
CREATE UNIQUE INDEX threads_unique_pair_listing
  ON public.threads (user_a, user_b, COALESCE(listing_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX threads_user_a_idx ON public.threads(user_a);
CREATE INDEX threads_user_b_idx ON public.threads(user_b);
CREATE INDEX threads_last_msg_idx ON public.threads(last_message_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.threads TO authenticated;
GRANT ALL ON public.threads TO service_role;

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their threads"
  ON public.threads FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can create threads they're in"
  ON public.threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Participants can update their threads"
  ON public.threads FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE TRIGGER threads_touch_updated_at
  BEFORE UPDATE ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ messages ============
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  sender_id uuid NULL,
  body text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','system','proposal','completion_request')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_created_idx ON public.messages(thread_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = messages.thread_id
      AND (auth.uid() = t.user_a OR auth.uid() = t.user_b)
  ));

CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND kind = 'text'
    AND EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = messages.thread_id
        AND (auth.uid() = t.user_a OR auth.uid() = t.user_b)
    )
  );

CREATE POLICY "Recipient can mark read"
  ON public.messages FOR UPDATE TO authenticated
  USING (
    sender_id IS DISTINCT FROM auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = messages.thread_id
        AND (auth.uid() = t.user_a OR auth.uid() = t.user_b)
    )
  );

-- bump thread last_message_at on insert
CREATE OR REPLACE FUNCTION public.messages_bump_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.threads SET last_message_at = NEW.created_at, updated_at = now()
    WHERE id = NEW.thread_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER messages_bump_thread_trg
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_bump_thread();

-- ============ transactions extensions ============
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS thread_id uuid NULL REFERENCES public.threads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS seller_confirmed_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS transactions_thread_idx ON public.transactions(thread_id);

-- Handshake trigger: when both parties confirm, mark completed + system message
CREATE OR REPLACE FUNCTION public.transactions_handshake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.buyer_confirmed_at IS NOT NULL
     AND NEW.seller_confirmed_at IS NOT NULL
     AND NEW.status <> 'completed' THEN
    NEW.status := 'completed';
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS transactions_handshake_trg ON public.transactions;
CREATE TRIGGER transactions_handshake_trg
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_handshake();

-- After completion, post system message into linked thread
CREATE OR REPLACE FUNCTION public.transactions_post_completion_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.thread_id IS NOT NULL THEN
    INSERT INTO public.messages(thread_id, sender_id, body, kind, meta)
    VALUES (NEW.thread_id, NULL,
            'Transaction successful! You can now rate each other.',
            'system',
            jsonb_build_object('transaction_id', NEW.id, 'event', 'completed'));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS transactions_post_completion_trg ON public.transactions;
CREATE TRIGGER transactions_post_completion_trg
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.transactions_post_completion_message();

-- ============ realtime ============
ALTER TABLE public.threads REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='threads';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.threads'; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages'; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='transactions';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions'; END IF;
END $$;
