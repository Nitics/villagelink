-- Allow the new "admin" (super user) role alongside customer and staff.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer','staff','admin'));

-- Make someone a super user (run in the Supabase SQL editor, with their email):
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'person@example.com');
