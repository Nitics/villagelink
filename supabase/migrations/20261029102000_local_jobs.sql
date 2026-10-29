-- ===== Local jobs and piece work =====
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'piece' check (kind in ('piece','job')),   -- piece = once-off work, job = ongoing position
  title text not null check (length(trim(title)) between 1 and 80),
  description text check (length(description) <= 600),
  pay numeric(10,2) check (pay is null or pay >= 0),
  pay_unit text check (pay_unit in ('hour','day','week','month','once')),
  town text references public.towns(name) on update cascade,
  work_when text check (length(work_when) <= 60),                       -- e.g. "Sat 2 Nov, 08:00" or "Start Monday"
  poster_name text not null check (length(trim(poster_name)) between 1 and 60),
  phone text not null check (length(regexp_replace(phone, '\D', '', 'g')) >= 9),
  closes_on date,                                                       -- hidden from the list after this date
  is_filled boolean not null default false,
  is_active boolean not null default true,                              -- staff can hide without deleting
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_town_idx on public.jobs (town, created_at desc) where is_active;
create index jobs_owner_idx on public.jobs (owner_id);
create trigger jobs_set_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;

-- Everyone sees active jobs; posters see their own; staff and super users see all (to review hidden ones).
create policy "Active jobs are public" on public.jobs
  for select to anon, authenticated using (is_active);
create policy "Posters see own jobs" on public.jobs
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "Staff see all jobs" on public.jobs
  for select to authenticated using ((select private.is_staff()));

-- Posters edit, fill and remove their own jobs; staff and super users manage all.
create policy "Posters and staff edit jobs" on public.jobs
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_staff()))
  with check (owner_id = (select auth.uid()) or (select private.is_staff()));
create policy "Posters and staff remove jobs" on public.jobs
  for delete to authenticated using (owner_id = (select auth.uid()) or (select private.is_staff()));

-- Signed-in people post jobs as themselves, at most 10 a day each (counted by a helper,
-- so the rule doesn't read its own table).
create or replace function private.jobs_posted_today()
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.jobs
  where owner_id = (select auth.uid()) and created_at > now() - interval '1 day';
$$;
revoke all on function private.jobs_posted_today() from public, anon;
grant execute on function private.jobs_posted_today() to authenticated;

create policy "Signed-in people post jobs" on public.jobs
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and (select private.jobs_posted_today()) < 10
  );
