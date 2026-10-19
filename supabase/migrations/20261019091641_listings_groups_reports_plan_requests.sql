-- ===== Resident reports: "I saw it open / closed" =====
create table public.status_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  is_open boolean not null,
  created_at timestamptz not null default now()
);
create index status_reports_business_idx on public.status_reports (business_id, created_at desc);
create index status_reports_user_idx on public.status_reports (user_id);
alter table public.status_reports enable row level security;
create policy "Reports are public" on public.status_reports
  for select to anon, authenticated using (true);
create policy "Signed-in people report" on public.status_reports
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ===== Buy and sell =====
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'goods' check (kind in ('goods','produce','service')),
  title text not null check (length(trim(title)) between 1 and 80),
  price numeric(10,2) not null check (price >= 0),
  unit text,
  town text references public.towns(name) on update cascade,
  seller_name text not null,
  phone text not null,
  note text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index listings_town_idx on public.listings (town, created_at desc) where is_active;
create index listings_owner_idx on public.listings (owner_id);
alter table public.listings enable row level security;
create policy "Active listings are public" on public.listings
  for select to anon, authenticated using (is_active or owner_id = (select auth.uid()));
create policy "Signed-in people post listings" on public.listings
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Sellers and staff edit listings" on public.listings
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_staff()))
  with check (owner_id = (select auth.uid()) or (select private.is_staff()));
create policy "Sellers and staff remove listings" on public.listings
  for delete to authenticated using (owner_id = (select auth.uid()) or (select private.is_staff()));

-- ===== Study groups =====
create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  grade text not null,
  title text not null check (length(trim(title)) between 1 and 80),
  place text not null,
  is_online boolean not null default false,
  next_session text not null,
  town text references public.towns(name) on update cascade,
  contact text,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index study_groups_town_idx on public.study_groups (town);
create index study_groups_owner_idx on public.study_groups (owner_id);
alter table public.study_groups enable row level security;
create policy "Study groups are public" on public.study_groups
  for select to anon, authenticated using (true);
create policy "Signed-in people create groups" on public.study_groups
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Creators and staff edit groups" on public.study_groups
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_staff()))
  with check (owner_id = (select auth.uid()) or (select private.is_staff()));
create policy "Creators and staff remove groups" on public.study_groups
  for delete to authenticated using (owner_id = (select auth.uid()) or (select private.is_staff()));

create table public.group_members (
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);
alter table public.group_members enable row level security;
create policy "Group membership is visible" on public.group_members
  for select to anon, authenticated using (true);
create policy "Join a group yourself" on public.group_members
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Leave a group yourself" on public.group_members
  for delete to authenticated using (user_id = (select auth.uid()));

-- ===== Business plan requests =====
create table public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  town text references public.towns(name) on update cascade,
  plan text not null check (plan in ('free','verified','featured')),
  contact_name text not null,
  phone text not null,
  details text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'new' check (status in ('new','done')),
  created_at timestamptz not null default now()
);
create index plan_requests_user_idx on public.plan_requests (user_id);
alter table public.plan_requests enable row level security;
create policy "See own requests, staff see all" on public.plan_requests
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy "Signed-in people request a plan" on public.plan_requests
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Staff handle requests" on public.plan_requests
  for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
