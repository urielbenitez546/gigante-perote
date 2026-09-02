-- ============================================================
-- CORRECCIÓN — Etapa 6 (Evidencias y Cobros)
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en una consulta NUEVA de tu Supabase si te salió el
-- error "Could not find the function public.confirm_delivery_payment
-- ... in the schema cache" al intentar confirmar un cobro.
--
-- QUÉ HACE (es seguro correrlo aunque ya hayas corrido 0009 antes,
-- se puede ejecutar las veces que haga falta sin romper nada):
-- 1) Elimina la versión VIEJA de update_delivery (la de 7 parámetros,
--    de antes de esta etapa) si todavía existe. Como le agregamos 4
--    parámetros nuevos, Postgres la trató como una función distinta
--    en vez de reemplazarla, así que pudieron quedar las DOS
--    versiones al mismo tiempo — eso confunde a Supabase.
-- 2) Vuelve a crear (con CREATE OR REPLACE) tanto update_delivery
--    como confirm_delivery_payment, por si la primera vez el script
--    se detuvo antes de llegar a crearlas.
-- 3) Le avisa a Supabase que recargue su caché de funciones de
--    inmediato, para no tener que esperar ni entrar manualmente a
--    "Reload schema" en Project Settings > API.
-- ============================================================

-- 1) Quita la versión vieja de update_delivery, si quedó.
drop function if exists public.update_delivery(uuid, delivery_status, text, text, numeric, numeric, text);

-- 2) Recrea update_delivery (idéntica a la de 0009, con CREATE OR REPLACE).
create or replace function public.update_delivery(
  p_delivery_id uuid,
  p_status delivery_status default null,
  p_driver_name text default null,
  p_vehicle text default null,
  p_initial_km numeric default null,
  p_current_km numeric default null,
  p_notes text default null,
  p_signature_path text default null,
  p_photo_paths text[] default null,
  p_amount_collected numeric default null,
  p_payment_method payment_method default null
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
    if p_signature_path is null then
      raise exception 'Debes capturar la firma del cliente para marcar como entregado';
    end if;
    if p_photo_paths is null or array_length(p_photo_paths, 1) is null or array_length(p_photo_paths, 1) = 0 then
      raise exception 'Debes subir al menos una foto de evidencia para marcar como entregado';
    end if;
    if p_amount_collected is null then
      raise exception 'Debes registrar el monto cobrado (puede ser 0 si no aplica) para marcar como entregado';
    end if;
    if p_payment_method is null then
      raise exception 'Debes indicar el método de pago para marcar como entregado';
    end if;

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
    signature_path = coalesce(p_signature_path, signature_path),
    photo_paths = coalesce(p_photo_paths, photo_paths),
    amount_collected = coalesce(p_amount_collected, amount_collected),
    payment_method = coalesce(p_payment_method, payment_method),
    delivered_at = case when p_status = 'entregado' then now() else delivered_at end
  where id = p_delivery_id;
end;
$$;

grant execute on function public.update_delivery(
  uuid, delivery_status, text, text, numeric, numeric, text, text, text[], numeric, payment_method
) to authenticated;

-- 3) Recrea confirm_delivery_payment (idéntica a la de 0009, ahora
--    con CREATE OR REPLACE para que no truene si ya existía).
create or replace function public.confirm_delivery_payment(
  p_delivery_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery record;
begin
  if public.current_user_role() not in ('gerencia', 'caja') then
    raise exception 'No tienes permiso para confirmar cobros';
  end if;

  select * into v_delivery from public.deliveries where id = p_delivery_id;
  if v_delivery is null then
    raise exception 'Reparto no encontrado';
  end if;
  if v_delivery.status <> 'entregado' then
    raise exception 'Este reparto todavía no está marcado como entregado';
  end if;
  if v_delivery.payment_confirmed_at is not null then
    raise exception 'Este cobro ya fue confirmado';
  end if;

  update public.deliveries
  set payment_confirmed_at = now(),
      payment_confirmed_by = auth.uid(),
      payment_notes = p_notes
  where id = p_delivery_id;
end;
$$;

grant execute on function public.confirm_delivery_payment(uuid, text) to authenticated;

-- 4) Fuerza a Supabase a recargar su caché de funciones ahora mismo.
notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la corrección
-- ============================================================
