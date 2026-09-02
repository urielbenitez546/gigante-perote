-- ============================================================
-- ETAPA 5 — Repartos
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001, 0002, 0003 y 0004 antes)
-- ============================================================

-- 1) Estado del reparto
create type delivery_status as enum ('pendiente', 'en_camino', 'entregado', 'incidencia');

-- 2) Tabla de repartos, 1 a 1 con una venta de tipo "domicilio"
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references public.sales (id) on delete cascade,
  status delivery_status not null default 'pendiente',
  driver_name text,
  vehicle text,
  initial_km numeric,
  current_km numeric,
  notes text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

alter table public.deliveries enable row level security;

create policy "Gerencia y Reparto pueden ver repartos"
  on public.deliveries for select
  using (public.current_user_role() in ('gerencia', 'reparto'));

-- 3) Se actualiza register_sale para que, cuando la venta sea a
--    domicilio, cree automáticamente su reparto correspondiente.
create or replace function public.register_sale(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_delivery_type delivery_type,
  p_items jsonb,
  p_scheduled_pickup_date date default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_folio text;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_status sale_status;
begin
  if public.current_user_role() not in ('gerencia', 'ventas') then
    raise exception 'No tienes permiso para registrar ventas';
  end if;

  if p_delivery_type = 'domicilio' and (p_customer_address is null or trim(p_customer_address) = '') then
    raise exception 'La dirección es obligatoria para entregas a domicilio';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  v_folio := 'V-' || nextval('public.sales_folio_seq');
  v_status := case when p_delivery_type = 'inmediata' then 'entregada' else 'pendiente' end;

  insert into public.sales (
    folio, customer_name, customer_phone, customer_address, delivery_type, status,
    created_by, delivered_at, scheduled_pickup_date
  )
  values (
    v_folio, p_customer_name, p_customer_phone, p_customer_address, p_delivery_type, v_status,
    auth.uid(),
    case when p_delivery_type = 'inmediata' then now() else null end,
    case when p_delivery_type = 'retiro_sucursal' then p_scheduled_pickup_date else null end
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;

    if v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero';
    end if;

    select unit_price into v_unit_price from public.products where id = v_product_id;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (v_sale_id, v_product_id, v_quantity, coalesce(v_unit_price, 0));

    v_total := v_total + (v_quantity * coalesce(v_unit_price, 0));

    if p_delivery_type = 'inmediata' then
      update public.products set physical_stock = physical_stock - v_quantity where id = v_product_id;
      insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
      values (v_product_id, 'salida', v_quantity, v_folio, auth.uid());
    else
      update public.products set sold_pending = sold_pending + v_quantity where id = v_product_id;
    end if;
  end loop;

  update public.sales set total = v_total where id = v_sale_id;

  if p_delivery_type = 'domicilio' then
    insert into public.deliveries (sale_id, status) values (v_sale_id, 'pendiente');
  end if;

  return v_folio;
end;
$$;

grant execute on function public.register_sale(text, text, text, delivery_type, jsonb, date) to authenticated;

-- 4) Función para actualizar un reparto: asignar chofer/vehículo,
--    registrar kilometraje, cambiar estado, o marcarlo como
--    entregado (lo cual descuenta el inventario real, igual que
--    "confirm_retiro" en Retiros en Sucursal).
create function public.update_delivery(
  p_delivery_id uuid,
  p_status delivery_status default null,
  p_driver_name text default null,
  p_vehicle text default null,
  p_initial_km numeric default null,
  p_current_km numeric default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery record;
  v_sale record;
  v_item record;
begin
  if public.current_user_role() not in ('gerencia', 'reparto') then
    raise exception 'No tienes permiso para actualizar repartos';
  end if;

  select * into v_delivery from public.deliveries where id = p_delivery_id;
  if v_delivery is null then
    raise exception 'Reparto no encontrado';
  end if;

  if p_status = 'entregado' and v_delivery.status <> 'entregado' then
    select * into v_sale from public.sales where id = v_delivery.sale_id;

    for v_item in select * from public.sale_items where sale_id = v_delivery.sale_id
    loop
      update public.products
      set physical_stock = physical_stock - v_item.quantity,
          sold_pending = sold_pending - v_item.quantity
      where id = v_item.product_id;

      insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
      values (v_item.product_id, 'salida', v_item.quantity, v_sale.folio, auth.uid());
    end loop;

    update public.sales set status = 'entregada', delivered_at = now() where id = v_delivery.sale_id;
  end if;

  update public.deliveries
  set
    status = coalesce(p_status, status),
    driver_name = coalesce(p_driver_name, driver_name),
    vehicle = coalesce(p_vehicle, vehicle),
    initial_km = coalesce(p_initial_km, initial_km),
    current_km = coalesce(p_current_km, current_km),
    notes = coalesce(p_notes, notes),
    delivered_at = case when p_status = 'entregado' then now() else delivered_at end
  where id = p_delivery_id;
end;
$$;

grant execute on function public.update_delivery(uuid, delivery_status, text, text, numeric, numeric, text) to authenticated;

-- ============================================================
-- Fin de la migración de la Etapa 5
-- ============================================================
