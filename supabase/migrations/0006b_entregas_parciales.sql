-- ============================================================
-- ETAPA — Entregas y retiros parciales (PARTE B)
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto DESPUÉS de que la Parte A (0006a) haya terminado
-- con éxito, en una consulta nueva.
--
-- QUÉ RESUELVE (a petición del jefe de almacén):
-- - Un cliente compra 50 cajas y se lleva 30 en el momento; las 20
--   restantes quedan pendientes de entregar/recoger después.
-- - Un cliente compra un producto que se lleva de inmediato y otro
--   que se le entrega después a domicilio, en la MISMA venta.
-- - Un cliente pasa varias veces a recoger partes de su pedido.
-- - Un pedido grande se reparte en varios viajes.
--
-- CÓMO: cada renglón de una venta ("sale_items") ahora sabe cuánto
-- de esa cantidad ya se entregó ("delivered_quantity") y qué tipo de
-- entrega le corresponde a ESE renglón (puede ser distinto al tipo
-- general de la venta). Los repartos ("deliveries") ahora pueden ser
-- varios por venta (varios "viajes"), cada uno con su propio
-- desglose de qué productos/cantidades lleva ese viaje.
--
-- CORRECCIÓN ADICIONAL: se detectó que el rol "reparto" no tenía
-- permiso para ver el detalle de las ventas asociadas a sus
-- repartos (solo veían el reparto, no los datos del cliente/
-- productos). Se corrige agregando "reparto" a esas políticas.
-- ============================================================

-- 1) Columnas nuevas en sale_items
alter table public.sale_items add column delivery_type delivery_type;
alter table public.sale_items add column delivered_quantity numeric not null default 0;

-- 2) Permitir varios repartos (viajes) por venta, cada uno con su
--    propio desglose de productos/cantidades.
alter table public.deliveries drop constraint if exists deliveries_sale_id_key;
alter table public.deliveries add column items jsonb;

-- 3) Corrección de permisos: Reparto también debe poder ver las
--    ventas y renglones asociados a sus repartos.
drop policy if exists "Roles con acceso a ventas/retiros pueden ver ventas" on public.sales;
create policy "Roles con acceso a ventas/retiros pueden ver ventas"
  on public.sales for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'almacen', 'reparto'));

drop policy if exists "Roles con acceso a ventas/retiros pueden ver renglones" on public.sale_items;
create policy "Roles con acceso a ventas/retiros pueden ver renglones"
  on public.sale_items for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'almacen', 'reparto'));

-- 4) register_sale: ahora cada producto de la venta puede tener su
--    propio tipo de entrega (si no se especifica, hereda el tipo
--    general de la venta).
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
  v_item_type delivery_type;
  v_sale_item_id uuid;
  v_domicilio_items jsonb := '[]'::jsonb;
begin
  if public.current_user_role() not in ('gerencia', 'ventas') then
    raise exception 'No tienes permiso para registrar ventas';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  v_folio := 'V-' || nextval('public.sales_folio_seq');

  insert into public.sales (
    folio, customer_name, customer_phone, customer_address, delivery_type, status,
    created_by, scheduled_pickup_date
  )
  values (
    v_folio, p_customer_name, p_customer_phone, p_customer_address, p_delivery_type, 'pendiente',
    auth.uid(),
    case when p_delivery_type = 'retiro_sucursal' then p_scheduled_pickup_date else null end
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_item_type := coalesce((v_item ->> 'delivery_type')::delivery_type, p_delivery_type);

    if v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero';
    end if;
    if v_item_type = 'domicilio' and (p_customer_address is null or trim(p_customer_address) = '') then
      raise exception 'La dirección es obligatoria para entregas a domicilio';
    end if;

    select unit_price into v_unit_price from public.products where id = v_product_id;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, delivery_type)
    values (v_sale_id, v_product_id, v_quantity, coalesce(v_unit_price, 0), v_item_type)
    returning id into v_sale_item_id;

    v_total := v_total + (v_quantity * coalesce(v_unit_price, 0));

    if v_item_type = 'inmediata' then
      update public.products set physical_stock = physical_stock - v_quantity where id = v_product_id;
      insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
      values (v_product_id, 'salida', v_quantity, v_folio, auth.uid());
      update public.sale_items set delivered_quantity = v_quantity where id = v_sale_item_id;
    else
      update public.products set sold_pending = sold_pending + v_quantity where id = v_product_id;
      if v_item_type = 'domicilio' then
        v_domicilio_items := v_domicilio_items || jsonb_build_array(
          jsonb_build_object('sale_item_id', v_sale_item_id, 'product_id', v_product_id, 'quantity', v_quantity)
        );
      end if;
    end if;
  end loop;

  update public.sales set total = v_total where id = v_sale_id;

  update public.sales
  set status = case
        when not exists (select 1 from public.sale_items where sale_id = v_sale_id and delivered_quantity < quantity) then 'entregada'::sale_status
        when exists (select 1 from public.sale_items where sale_id = v_sale_id and delivered_quantity > 0) then 'parcial'::sale_status
        else 'pendiente'::sale_status
      end,
      delivered_at = case
        when not exists (select 1 from public.sale_items where sale_id = v_sale_id and delivered_quantity < quantity) then now()
        else null
      end
  where id = v_sale_id;

  if jsonb_array_length(v_domicilio_items) > 0 then
    insert into public.deliveries (sale_id, status, items) values (v_sale_id, 'pendiente', v_domicilio_items);
  end if;

  return v_folio;
end;
$$;

grant execute on function public.register_sale(text, text, text, delivery_type, jsonb, date) to authenticated;

-- 5) Reemplaza confirm_retiro por register_retiro: permite retirar
--    TODO lo pendiente de un jalón (como antes, si no se le pasan
--    renglones) o solo PARTE de él (pasando qué renglón y cuánto).
drop function if exists public.confirm_retiro(uuid);

create function public.register_retiro(
  p_sale_id uuid,
  p_items jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_sale_item_id uuid;
  v_quantity numeric;
  v_remaining numeric;
  v_product_id uuid;
  v_folio text;
  v_items jsonb;
begin
  if public.current_user_role() not in ('gerencia', 'ventas', 'almacen') then
    raise exception 'No tienes permiso para confirmar retiros';
  end if;

  select folio into v_folio from public.sales where id = p_sale_id;
  if v_folio is null then
    raise exception 'Venta no encontrada';
  end if;

  if p_items is null then
    select jsonb_agg(jsonb_build_object('sale_item_id', id, 'quantity', quantity - delivered_quantity))
    into v_items
    from public.sale_items
    where sale_id = p_sale_id and delivery_type = 'retiro_sucursal' and delivered_quantity < quantity;
  else
    v_items := p_items;
  end if;

  if v_items is null or jsonb_array_length(v_items) = 0 then
    raise exception 'No hay nada pendiente de retiro para esta venta';
  end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_sale_item_id := (v_item ->> 'sale_item_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;

    select (quantity - delivered_quantity), product_id into v_remaining, v_product_id
    from public.sale_items where id = v_sale_item_id and sale_id = p_sale_id;

    if v_remaining is null then
      raise exception 'Renglón de venta no encontrado';
    end if;
    if v_quantity <= 0 or v_quantity > v_remaining then
      raise exception 'Cantidad inválida para retiro (pendiente: %)', v_remaining;
    end if;

    update public.sale_items set delivered_quantity = delivered_quantity + v_quantity where id = v_sale_item_id;
    update public.products
    set physical_stock = physical_stock - v_quantity, sold_pending = sold_pending - v_quantity
    where id = v_product_id;
    insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
    values (v_product_id, 'salida', v_quantity, v_folio, auth.uid());
  end loop;

  update public.sales
  set status = case
        when not exists (select 1 from public.sale_items where sale_id = p_sale_id and delivered_quantity < quantity) then 'entregada'::sale_status
        else 'parcial'::sale_status
      end,
      delivered_at = case
        when not exists (select 1 from public.sale_items where sale_id = p_sale_id and delivered_quantity < quantity) then now()
        else delivered_at
      end
  where id = p_sale_id;
end;
$$;

grant execute on function public.register_retiro(uuid, jsonb) to authenticated;

-- 6) update_delivery: ahora cada reparto puede traer su propio
--    desglose de qué renglones/cantidades cubre ESE viaje. Si no
--    trae desglose (repartos creados antes de este cambio), se
--    comporta como antes: cubre todo lo pendiente a domicilio de
--    la venta.
create or replace function public.update_delivery(
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
  v_item jsonb;
  v_sale_item_id uuid;
  v_quantity numeric;
  v_product_id uuid;
  v_pending record;
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

    if v_delivery.items is not null then
      for v_item in select * from jsonb_array_elements(v_delivery.items)
      loop
        v_sale_item_id := (v_item ->> 'sale_item_id')::uuid;
        v_quantity := (v_item ->> 'quantity')::numeric;
        v_product_id := (v_item ->> 'product_id')::uuid;

        update public.sale_items set delivered_quantity = delivered_quantity + v_quantity where id = v_sale_item_id;
        update public.products
        set physical_stock = physical_stock - v_quantity, sold_pending = sold_pending - v_quantity
        where id = v_product_id;
        insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
        values (v_product_id, 'salida', v_quantity, v_sale.folio, auth.uid());
      end loop;
    else
      for v_pending in
        select id, product_id, (quantity - delivered_quantity) as pendiente
        from public.sale_items
        where sale_id = v_delivery.sale_id and delivery_type = 'domicilio' and delivered_quantity < quantity
      loop
        update public.sale_items set delivered_quantity = quantity where id = v_pending.id;
        update public.products
        set physical_stock = physical_stock - v_pending.pendiente, sold_pending = sold_pending - v_pending.pendiente
        where id = v_pending.product_id;
        insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
        values (v_pending.product_id, 'salida', v_pending.pendiente, v_sale.folio, auth.uid());
      end loop;
    end if;

    update public.sales
    set status = case
          when not exists (select 1 from public.sale_items where sale_id = v_delivery.sale_id and delivered_quantity < quantity) then 'entregada'::sale_status
          else 'parcial'::sale_status
        end,
        delivered_at = case
          when not exists (select 1 from public.sale_items where sale_id = v_delivery.sale_id and delivered_quantity < quantity) then now()
          else delivered_at
        end
    where id = v_delivery.sale_id;
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

-- 7) Nueva función: crear un "viaje adicional" para lo que falte
--    entregar a domicilio de una venta (ej. pedido grande en varios
--    viajes, o parte de un pedido mixto).
create function public.create_additional_delivery(p_sale_id uuid, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_id uuid;
  v_item jsonb;
  v_sale_item_id uuid;
  v_quantity numeric;
  v_remaining numeric;
begin
  if public.current_user_role() not in ('gerencia', 'reparto', 'ventas', 'almacen') then
    raise exception 'No tienes permiso para crear repartos';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Debes especificar al menos un producto para el viaje';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_sale_item_id := (v_item ->> 'sale_item_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;

    select (quantity - delivered_quantity) into v_remaining
    from public.sale_items where id = v_sale_item_id and sale_id = p_sale_id;

    if v_remaining is null or v_quantity <= 0 or v_quantity > v_remaining then
      raise exception 'Cantidad inválida para el viaje (pendiente: %)', coalesce(v_remaining, 0);
    end if;
  end loop;

  insert into public.deliveries (sale_id, status, items)
  values (p_sale_id, 'pendiente', p_items)
  returning id into v_delivery_id;

  return v_delivery_id;
end;
$$;

grant execute on function public.create_additional_delivery(uuid, jsonb) to authenticated;

-- ============================================================
-- Fin de la Parte B
-- ============================================================
