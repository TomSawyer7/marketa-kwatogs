alter table public.verifications
  add column if not exists qr_payload text,
  add column if not exists everify_status text not null default 'not_checked',
  add column if not exists everify_checked_at timestamptz,
  add column if not exists everify_checked_by uuid,
  add column if not exists everify_notes text;

-- Add a check constraint for the everify_status values
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'verifications_everify_status_check'
  ) then
    alter table public.verifications
      add constraint verifications_everify_status_check
      check (everify_status in ('not_checked', 'passed', 'failed'));
  end if;
end $$;