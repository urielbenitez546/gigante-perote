-- ============================================================
-- ETAPA 6 — Evidencias y Cobros
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001 a 0008 antes)
--
-- IMPORTANTE — paso manual previo (igual que con "facturas"/"merma"):
-- Antes de correr este script, crea en el Dashboard de Supabase
-- (Storage) dos buckets nuevos, AMBOS como "Public":
--   - repartos-firmas      (guarda la firma del cliente en canvas)
--   - repartos-evidencia   (guarda las fotos de evidencia de entrega)
-- La lectura pública simplifica el prototipo; la restricción real
-- está en quién puede SUBIR archivos (ver política más abajo).
--
-- QUÉ RESUELVE:
-- Retoma el proceso real de cobro en reparto que confirmaste:
-- el chofer entrega el material, recibe el dinero del cliente
-- (efectivo, transferencia o tarjeta), captura la firma del cliente
-- en canvas y foto(s) de evidencia, y marca el reparto como
-- "Entregado". Esto YA NO se puede hacer sin esa evidencia (ver
-- validación en update_delivery). Después, Caja recibe físicamente
-- ese dinero de manos del chofer y es quien da la CONFIRMACIÓN FINAL
-- de que el reparto y su cobro quedaron cerrados, desde la nueva
-- pantalla "Evidencias y Cobros".
-- ============================================================

-- 1) Método de pago con el que se cobró en el domicilio.
create type payment_method as enum ('efectivo', 'transferencia', 'tarjeta');

-- 2) Políticas de Storage: solo Gerencia y Reparto pueden SUBIR
--    firmas y evidencia fotográfica (la lectura ya es pública porque
--    los buckets se crearon como "Public").
create policy "Gerencia y Reparto pueden subir firmas de repartos"
  on storage.objects for insert
  with check (bucket_id = 'repartos-firmas' and public.current_user_role() in ('gerencia', 'reparto'));

create policy "Gerencia y Reparto pueden subir evidencia de repartos"
  on storage.objects for insert
  with check (bucket_id = 'repartos-evidencia' and public.current_user_role() in ('gerencia', 'reparto'));

-- 3) Columnas nuevas en "deliveries" para guardar la evidencia y el
--    estado del cobro de cada viaje/reparto.
alter table public.deliveries add column signature_path text;
alter table public.deliveries add column photo_paths text[];
alter table public.deliveries add column amount_collected numeric;
alter table public.deliveries add column payment_method payment_method;
alter table public.deliveries add column payment_confirmed_at timestamptz;
alter table public.deliveries add column payment_confirmed_by uuid references auth.users (id);
alter table public.deliveries add column payment_notes text;

-- 4) Corrección de permisos: Caja también debe poder VER los
--    repartos (necesita ver firma, fotos y monto cobrado para poder
--    confirmar el cobro en la nueva pantalla).
drop policy if exists "Gerencia y Reparto pueden ver repartos" on public.deliveries;
create policy "Gerencia, Reparto y Caja pueden ver repartos"
  on public.deliveries for select
  using (public.current_user_role() in ('gerencia', 'reparto', 'caja'));

-- 5) update_delivery: ahora también recibe la evidencia de entrega.
--    Regla nueva: para marcar un reparto como "entregado" (la
--    primera vez), es OBLIGATORIO traer firma, al menos una foto y
--    el monto cobrado. Si el reparto ya estaba "entregado", estos
--    campos son opcionales (permite corregir sin perder lo demás).
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

-- 6) Nueva función: Caja (o Gerencia) confirma que recibió físicamente
--    el dinero de manos del chofer y da por cerrado el cobro de ese
--    reparto. Solo se puede confirmar una vez, y solo si el reparto
--    ya está "entregado".
create function public.confirm_delivery_payment(
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

-- ============================================================
-- Fin de la migración de la Etapa 6
-- ============================================================
