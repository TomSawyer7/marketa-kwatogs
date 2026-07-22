-- Extend messages for Messenger-style actions
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_unsent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz NULL;

ALTER TABLE public.messages ALTER COLUMN body DROP NOT NULL;

CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON public.messages(reply_to_message_id);

-- Enforce immutable fields + auto-flag edit/unsend
CREATE OR REPLACE FUNCTION public.messages_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.thread_id IS DISTINCT FROM OLD.thread_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.reply_to_message_id IS DISTINCT FROM OLD.reply_to_message_id THEN
    RAISE EXCEPTION 'Immutable message fields cannot be modified';
  END IF;

  IF OLD.is_unsent = true THEN
    RAISE EXCEPTION 'Cannot modify an unsent message';
  END IF;

  IF NEW.is_unsent = true AND OLD.is_unsent = false THEN
    NEW.body := NULL;
    NEW.image_url := NULL;
    NEW.edited_at := now();
  ELSIF NEW.body IS DISTINCT FROM OLD.body OR NEW.image_url IS DISTINCT FROM OLD.image_url THEN
    NEW.is_edited := true;
    NEW.edited_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_guard_update_trg ON public.messages;
CREATE TRIGGER messages_guard_update_trg
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_guard_update();

-- Allow sender to update their own non-unsent messages
DROP POLICY IF EXISTS "Sender can update own message" ON public.messages;
CREATE POLICY "Sender can update own message"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id AND is_unsent = false)
WITH CHECK (auth.uid() = sender_id);