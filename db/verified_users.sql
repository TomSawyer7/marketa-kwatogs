-- Run this in the Lovable Cloud SQL editor (or ask the agent to apply it once the migration tool is available).
-- Adds rich OCR fields to `verifications` and creates `verified_users`.

alter table public.verifications
  add column if not exists ocr_first_name        text,
  add column if not exists ocr_middle_name       text,
  add column if not exists ocr_last_name         text,
  add column if not exists ocr_document_number   text,
  add column if not exists ocr_nationality       text,
  add column if not exists ocr_place_of_birth    text,
  add column if not exists ocr_blood_type        text,
  add column if not exists ocr_marital_status    text,
  add column if not exists ocr_date_of_issue     date,
  add column if not exists ocr_sex               text;

create table if not exists public.verified_users (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  full_name        text not null,
  first_name       text,
  middle_name      text,
  last_name        text,
  document_number  text,
  date_of_birth    date,
  address          text,
  sex              text,
  nationality      text,
  place_of_birth   text,
  blood_type       text,
  marital_status   text,
  date_of_issue    date,
  verified_at      timestamptz not null default now()
);

alter table public.verified_users enable row level security;

drop policy if exists "Users can view own verified row" on public.verified_users;
create policy "Users can view own verified row"
  on public.verified_users
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all verified rows" on public.verified_users;
create policy "Admins can view all verified rows"
  on public.verified_users
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create index if not exists verified_users_document_number_idx
  on public.verified_users (document_number);
