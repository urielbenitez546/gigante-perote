-- ============================================================
-- ETAPA 4 — Ventas y Entregas + Retiros en Sucursal
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001 y 0002 antes)
--
-- FLUJO DE ENTREGA (confirmado con el cliente):
-- - "inmediata": el cliente paga y se lleva el material en el momento.
--   Se descuenta la existencia física de una vez, sin quedar pendiente.
-- - "retiro_sucursal": el cliente pagará y recogerá después en la
--   sucursal. Al vender, solo aumenta "vendidos pendientes" (existencia
--   física NO se toca todavía). Al confirmar el retiro (este módulo),
--   se descuenta la existencia física real y se libera lo pendiente.
-- - "domicilio": se entregará después mediante reparto. Por ahora solo
--   queda registrada como pendiente; la confirmación real de entrega
--   se conecta en la Etapa 5 (Repartos).
-- ============================================================

-- 1) Precio DEMO por producto (para poder calcular totales de venta).
--    Es un precio de DEMOSTRACIÓN, no una lista de precios real.
alter table public.products add column unit_price numeric not null default 0;

update public.products set unit_price = case code
  when 'DEMO-001' then 450
  when 'DEMO-002' then 380
  when 'DEMO-003' then 620
  when 'DEMO-004' then 210
  when 'DEMO-005' then 95
  when 'DEMO-006' then 410
  when 'DEMO-007' then 350
  when 'DEMO-008' then 700
  else 0
end;

-- 2) Tipos
create type delivery_type as enum ('inmediata', 'retiro_sucursal', 'domicilio');
create type sale_status as enum ('pendiente', 'entregada', 'cancelada');

-- 3) Folio autoincremental para ventas (ej. "V-1001")
create sequence public.sales_folio_seq start 1001;

-- 4) Tabla de ventas
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  delivery_type delivery_type not null,
  status sale_status not null default 'pendiente',
  total numeric not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

-- 5) Renglones de la venta (productos incluidos)
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null default 0
);

-- 6) RLS
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy "Roles con acceso a ventas/retiros pueden ver ventas"
  on public.sales for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'almacen'));

create policy "Roles con acceso a ventas/retiros pueden ver renglones"
  on public.sale_items for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'almacen'));

-- No hay políticas de insert/update directas: todo pasa por las
-- funciones de abajo (SECURITY DEFINER), que validan el rol.

-- 7) Función que registra una venta completa de forma atómica:
--    crea la venta, sus renglones, y mueve el inventario según el
--    tipo de entrega.
--    p_items es un jsonb con la forma: [{"product_id":"...","quantity":10}, ...]
create function public.register_sale(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_delivery_type delivery_type,
  p_items jsonb
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

  insert into public.sales (folio, customer_name, customer_phone, customer_address, delivery_type, status, created_by, delivered_at)
  values (
    v_folio, p_customer_name, p_customer_phone, p_customer_address, p_delivery_type, v_status, auth.uid(),
    case when p_delivery_type = 'inmediata' then now() else null end
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
      -- Se entrega en el momento: se descuenta la existencia física de una vez.
      update public.products set physical_stock = physical_stock - v_quantity where id = v_product_id;
      insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
      values (v_product_id, 'salida', v_quantity, v_folio, auth.uid());
    else
      -- Entrega posterior (retiro en sucursal o domicilio): solo se
      -- "aparta" el material. La existencia física se descuenta hasta
      -- que se confirme la entrega real.
      update public.products set sold_pending = sold_pending + v_quantity where id = v_product_id;
    end if;
  end loop;

  update public.sales set total = v_total where id = v_sale_id;

  return v_folio;
end;
$$;

grant execute on function public.register_sale(text, text, text, delivery_type, jsonb) to authenticated;

-- 8) Función que confirma un retiro en sucursal: descuenta la
--    existencia física real y libera lo que estaba pendiente.
create function public.confirm_retiro(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_item record;
begin
  if public.current_user_role() not in ('gerencia', 'ventas', 'almacen') then
    raise exception 'No tienes permiso para confirmar retiros';
  end if;

  select * into v_sale from public.sales where id = p_sale_id;

  if v_sale is null then
    raise exception 'Venta no encontrada';
  end if;

  if v_sale.delivery_type <> 'retiro_sucursal' then
    raise exception 'Esta venta no corresponde a un retiro en sucursal';
  end if;

  if v_sale.status <> 'pendiente' then
    raise exception 'Esta venta ya fue procesada';
  end if;

  for v_item in select * from public.sale_items where sale_id = p_sale_id
  loop
    update public.products
    set physical_stock = physical_stock - v_item.quantity,
        sold_pending = sold_pending - v_item.quantity
    where id = v_item.product_id;

    insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
    values (v_item.product_id, 'salida', v_item.quantity, v_sale.folio, auth.uid());
  end loop;

  update public.sales set status = 'entregada', delivered_at = now() where id = p_sale_id;
end;
$$;

grant execute on function public.confirm_retiro(uuid) to authenticated;

-- ============================================================
-- Fin de la migración de la Etapa 4
-- ============================================================
