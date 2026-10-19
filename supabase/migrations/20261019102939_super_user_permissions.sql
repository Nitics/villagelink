-- Super user ("admin") checks and permissions.
create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Super users have every staff permission.
create or replace function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('staff','admin'));
$$;

create policy "Super users delete orders" on public.orders
  for delete to authenticated using ((select private.is_admin()));
create policy "Super users delete plan requests" on public.plan_requests
  for delete to authenticated using ((select private.is_admin()));
create policy "Super users delete reports" on public.status_reports
  for delete to authenticated using ((select private.is_admin()));

create policy "Super users add towns" on public.towns
  for insert to authenticated with check ((select private.is_admin()));
create policy "Super users edit towns" on public.towns
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Super users remove towns" on public.towns
  for delete to authenticated using ((select private.is_admin()));

-- Every account with its role and the businesses it runs (super users only).
create or replace function public.admin_list_users()
returns table (id uuid, email text, display_name text, role text, created_at timestamptz, last_sign_in_at timestamptz, business_ids uuid[])
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only super users can see all accounts' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, p.display_name, coalesce(p.role, 'customer'), u.created_at, u.last_sign_in_at,
           coalesce(array_agg(m.business_id) filter (where m.business_id is not null), '{}')
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.business_members m on m.user_id = u.id
    group by u.id, u.email, p.display_name, p.role, u.created_at, u.last_sign_in_at
    order by u.created_at;
end;
$$;

-- Change someone's role and name (super users only).
create or replace function public.admin_update_user(p_user uuid, p_role text, p_display_name text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only super users can change accounts' using errcode = '42501';
  end if;
  if p_role not in ('customer','staff','admin') then
    raise exception 'Choose customer, staff or super user' using errcode = '22023';
  end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'You can’t remove your own super user role. Ask another super user.' using errcode = '22023';
  end if;
  insert into public.profiles (id, role, display_name)
  values (p_user, p_role, nullif(left(trim(coalesce(p_display_name, '')), 60), ''))
  on conflict (id) do update set role = excluded.role,
    display_name = coalesce(nullif(left(trim(coalesce(p_display_name, '')), 60), ''), public.profiles.display_name);
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_update_user(uuid, text, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_update_user(uuid, text, text) to authenticated;
