-- How many assistant questions each person asked per day (South African date).
create table public.assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  questions int not null default 0,
  primary key (user_id, day)
);
alter table public.assistant_usage enable row level security;
-- No policies: only the assistant server (service role) reads and writes this table.

-- Counts one question and says whether the person is still within today's limit.
create or replace function public.use_assistant_question(p_user uuid, p_limit int default 30)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_count int;
begin
  insert into public.assistant_usage (user_id, day, questions)
  values (p_user, (now() at time zone 'Africa/Johannesburg')::date, 1)
  on conflict (user_id, day) do update set questions = public.assistant_usage.questions + 1
  returning questions into v_count;
  return v_count <= p_limit;
end;
$$;
revoke all on function public.use_assistant_question(uuid, int) from public, anon, authenticated;
grant execute on function public.use_assistant_question(uuid, int) to service_role;
