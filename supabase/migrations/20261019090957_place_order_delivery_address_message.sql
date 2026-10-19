-- Placing an order: the only way customers create orders.
-- items: [{"product_id": "...", "qty": 2}, ...]  (may be empty if the note says what they need)
-- Prices always come from the products table, never from the app.
create or replace function public.place_order(
  p_business_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_method text default 'collect',
  p_delivery_address text default null,
  p_note text default null,
  p_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty int;
  v_total numeric(10,2) := 0;
begin
  if v_uid is null then
    raise exception 'Sign in to place an order' using errcode = '28000';
  end if;
  if not exists (select 1 from public.businesses where id = p_business_id and is_active and sells_online) then
    raise exception 'This shop is not taking orders' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_customer_name,''))) = 0 or length(regexp_replace(coalesce(p_customer_phone,''), '\D', '', 'g')) < 9 then
    raise exception 'Add your name and a phone number with at least 9 digits' using errcode = '22023';
  end if;
  if coalesce(p_method,'collect') not in ('collect','delivery') then
    raise exception 'Choose collect or delivery' using errcode = '22023';
  end if;
  if p_method = 'delivery' and length(trim(coalesce(p_delivery_address,''))) = 0 then
    raise exception 'Add a delivery address or landmark' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb)) > 50 then
    raise exception 'Too many items in one order' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 and length(trim(coalesce(p_note,''))) = 0 then
    raise exception 'Add at least one item, or write what you need' using errcode = '22023';
  end if;
  if (select count(*) from public.orders where customer_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many orders. Try again later.' using errcode = '22023';
  end if;

  insert into public.orders (business_id, customer_id, customer_name, customer_phone, method, delivery_address, note)
  values (p_business_id, v_uid, left(trim(p_customer_name), 60), left(trim(p_customer_phone), 20),
          coalesce(p_method,'collect'), nullif(left(trim(coalesce(p_delivery_address,'')), 200), ''), nullif(left(trim(coalesce(p_note,'')), 500), ''))
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and business_id = p_business_id;
    if not found then
      raise exception 'A product is not sold by this shop' using errcode = '22023';
    end if;
    if not v_product.in_stock then
      raise exception '% is out of stock', v_product.name using errcode = '22023';
    end if;
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Quantity must be between 1 and 99' using errcode = '22023';
    end if;
    insert into public.order_items (order_id, product_id, product_name, unit_price, qty)
    values (v_order, v_product.id, v_product.name, v_product.price, v_qty);
    v_total := v_total + v_product.price * v_qty;
  end loop;

  update public.orders set total = v_total where id = v_order;
  return v_order;
end;
$$;

revoke all on function public.place_order(uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.place_order(uuid, text, text, text, text, text, jsonb) to authenticated;
