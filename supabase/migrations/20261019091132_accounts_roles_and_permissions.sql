-- ===== Profiles: one per account =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','staff')),
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data->>'display_name', ''), 60), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== Shop owners and shop staff linked to a business =====
create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

-- ===== Helper checks (used by security rules) =====
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'staff');
$$;

create or replace function private.is_member(p_business_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.business_members
                 where business_id = p_business_id and user_id = (select auth.uid()));
$$;
revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_member(uuid) from public, anon;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_member(uuid) to authenticated;

-- ===== Security rules =====
alter table public.profiles enable row level security;
alter table public.business_members enable row level security;

-- Profiles: you see and edit your own; staff see everyone. Nobody can change their own role.
create policy "See own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select private.is_staff()));
create policy "Edit own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated, anon;
grant update (display_name, phone) on public.profiles to authenticated;

-- Business members: you see your own links; staff manage all links.
create policy "See own shop links" on public.business_members
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy "Staff manage shop links" on public.business_members
  for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

-- Businesses: staff see hidden ones too and can add, edit and delete.
create policy "Staff see all businesses" on public.businesses
  for select to authenticated using ((select private.is_staff()));
create policy "Staff add businesses" on public.businesses
  for insert to authenticated with check ((select private.is_staff()));
create policy "Staff edit businesses" on public.businesses
  for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff delete businesses" on public.businesses
  for delete to authenticated using ((select private.is_staff()));

-- Products: shop owners manage their own shop's products; staff manage all.
create policy "Owners and staff add products" on public.products
  for insert to authenticated with check ((select private.is_staff()) or private.is_member(business_id));
create policy "Owners and staff edit products" on public.products
  for update to authenticated
  using ((select private.is_staff()) or private.is_member(business_id))
  with check ((select private.is_staff()) or private.is_member(business_id));
create policy "Owners and staff delete products" on public.products
  for delete to authenticated using ((select private.is_staff()) or private.is_member(business_id));

-- Orders: shop owners see their shop's orders; staff see all.
create policy "Owners and staff see shop orders" on public.orders
  for select to authenticated using ((select private.is_staff()) or private.is_member(business_id));
create policy "Owners and staff see shop order lines" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and ((select private.is_staff()) or private.is_member(o.business_id))));

-- ===== Actions for shop owners =====

-- Confirm "open now" or "closed" (valid for 3 hours in the app).
create or replace function public.confirm_business_status(p_business_id uuid, p_open boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (private.is_staff() or private.is_member(p_business_id)) then
    raise exception 'Only this business can confirm its status' using errcode = '42501';
  end if;
  update public.businesses
     set confirmed_open = p_open, confirmed_at = now(), confirmed_note = nullif(left(trim(coalesce(p_note,'')), 140), '')
   where id = p_business_id;
end;
$$;

-- Update everyday details (not the plan, category or visibility, which staff control).
create or replace function public.update_business_details(
  p_business_id uuid,
  p_phone text default null,
  p_whatsapp text default null,
  p_address text default null,
  p_opening_hours text default null,
  p_description text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (private.is_staff() or private.is_member(p_business_id)) then
    raise exception 'Only this business can change its details' using errcode = '42501';
  end if;
  update public.businesses set
    phone = coalesce(left(trim(p_phone), 20), phone),
    whatsapp = coalesce(left(trim(p_whatsapp), 20), whatsapp),
    address = coalesce(left(trim(p_address), 200), address),
    opening_hours = coalesce(left(trim(p_opening_hours), 200), opening_hours),
    hours_checked = case when p_opening_hours is not null then current_date else hours_checked end,
    description = coalesce(left(trim(p_description), 500), description)
  where id = p_business_id;
end;
$$;

-- Move an order along: sent -> accepted -> ready -> done, or declined.
create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_business uuid; v_current text;
begin
  select business_id, status into v_business, v_current from public.orders where id = p_order_id;
  if not found or not (private.is_staff() or private.is_member(v_business)) then
    raise exception 'Order not found' using errcode = '42501';
  end if;
  if p_status not in ('accepted','ready','done','declined') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  if v_current in ('done','declined','cancelled') then
    raise exception 'This order is already closed' using errcode = '22023';
  end if;
  update public.orders set status = p_status where id = p_order_id;
end;
$$;

revoke all on function public.confirm_business_status(uuid, boolean, text) from public, anon;
revoke all on function public.update_business_details(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.set_order_status(uuid, text) from public, anon;
grant execute on function public.confirm_business_status(uuid, boolean, text) to authenticated;
grant execute on function public.update_business_details(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;
