ALTER TABLE public.verifications
  ADD COLUMN IF NOT EXISTS liveness_video_path text,
  ADD COLUMN IF NOT EXISTS liveness_frame_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS liveness_checked_at timestamptz;

ALTER TABLE public.verifications DROP CONSTRAINT IF EXISTS verifications_status_check;

UPDATE public.verifications SET status = 'awaiting_liveness' WHERE status = 'id_approved';

ALTER TABLE public.verifications
  ADD CONSTRAINT verifications_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'awaiting_liveness'::text, 'id_approved'::text, 'verified'::text, 'rejected'::text]));