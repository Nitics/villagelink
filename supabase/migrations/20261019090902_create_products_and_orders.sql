-- What shops sell.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  price numeric(10,2) not null check (price >= 0),
  unit text,                                  -- "each", "10 kg bag", "voucher"
  in_stock boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_business_idx on public.products (business_id, sort_order);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Orders from customers to one shop.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  method text not null default 'collect' check (method in ('collect','delivery')),
  delivery_address text,
  note text,
  status text not null default 'sent' check (status in ('sent','accepted','ready','done','declined','cancelled')),
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (method = 'collect' or length(trim(coalesce(delivery_address,''))) > 0)
);
create index orders_business_idx on public.orders (business_id, created_at desc);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Lines in an order. Name and price are copied so old orders stay correct after price changes.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  qty int not null check (qty between 1 and 99)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- Security
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Products of active businesses are public" on public.products
  for select to anon, authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.is_active));

create policy "Customers see their own orders" on public.orders
  for select to authenticated
  using (customer_id = (select auth.uid()));

create policy "Customers see items in their own orders" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));

-- Customers can cancel their own order while the shop hasn't accepted it yet.
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders set status = 'cancelled'
  where id = p_order_id and customer_id = auth.uid() and status = 'sent';
  if not found then
    raise exception 'This order can no longer be cancelled' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;

-- place_order is defined in the next migration (20261019090957).
