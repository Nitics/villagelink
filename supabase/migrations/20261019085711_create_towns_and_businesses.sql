-- Towns and villages in the Nkomazi Local Municipality.
create table public.towns (
  name text primary key,
  latitude double precision,   -- approximate town centre
  longitude double precision,
  sort_order int not null default 0
);

insert into public.towns (name, latitude, longitude, sort_order) values
  ('Malelane', -25.483, 31.513, 1),
  ('Komatipoort', -25.433, 31.950, 2),
  ('Hectorspruit', -25.433, 31.683, 3),
  ('Marloth Park', -25.350, 31.783, 4),
  ('KaMaqhekeza', -25.655, 31.630, 5),
  ('Kamhlushwa', -25.660, 31.690, 6),
  ('Tonga', -25.690, 31.785, 7),
  ('Mangweni', -25.735, 31.860, 8),
  ('Naas', -25.640, 31.850, 9),
  ('Schoemansdal', -25.885, 31.610, 10),
  ('Jeppes Reef', -25.740, 31.470, 11),
  ('Driekoppies', -25.700, 31.540, 12),
  ('Mbuzini', -25.930, 31.930, 13),
  ('Steenbok', -25.580, 31.560, 14),
  ('Langeloop', -25.600, 31.870, 15);

-- Businesses and services.
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null default 'other' check (category in (
    'fuel','spaza','supermarket','shop','butcher','bakery','hardware',
    'clinic','pharmacy','hospital','doctor','police','bank','post',
    'school','service','other')),
  type_label text,                         -- e.g. "24-hour fuel station"
  town text references public.towns(name) on update cascade,
  address text,                            -- address or landmark
  phone text,
  whatsapp text,
  opening_hours text,                      -- "Mo-Fr 07:00-18:00; Sa 08:00-13:00; Su off" or "24/7"
  hours_checked date,                      -- when someone last confirmed the hours
  sells_online boolean not null default false,
  plan text not null default 'free' check (plan in ('free','verified','featured')),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  description text,
  source text not null default 'yours' check (source in ('yours','openstreetmap','resident')),
  osm_id text unique,                      -- set for entries pulled from OpenStreetMap
  -- Owner's "open now" confirmation (valid for 3 hours)
  confirmed_open boolean,
  confirmed_at timestamptz,
  confirmed_note text,
  is_active boolean not null default true, -- hide without deleting
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One business per name per town (used when importing to update instead of duplicating).
create unique index businesses_name_town_key on public.businesses (lower(name), town);
create index businesses_town_category_idx on public.businesses (town, category) where is_active;

-- Keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

-- Security: anyone can read; nobody can write through the public API yet.
alter table public.towns enable row level security;
alter table public.businesses enable row level security;

create policy "Towns are public" on public.towns
  for select to anon, authenticated using (true);

create policy "Active businesses are public" on public.businesses
  for select to anon, authenticated using (is_active);
