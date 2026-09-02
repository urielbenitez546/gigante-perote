-- ============================================================
-- ETAPA EXTRA — Notificaciones (campanita funcional)
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001 a 0013 antes)
--
-- NOTA TÉCNICA: este script es SEGURO de correr más de una vez.
--
-- QUÉ RESUELVE:
-- La campanita del encabezado no hacía nada. Ahora:
-- 1) Cuando un reparto se marca como "Incidencia", se crea
--    automáticamente una notificación visible para TODOS los roles,
--    con un link directo a ese reparto para poder atenderlo rápido.
-- 2) Cualquier persona puede reportar un problema a mano (botón "+"
--    junto a la campanita) y también le llega a todos.
-- 3) Cada quien ve su propio contador de "no leídas" y puede marcar
--    una o todas como leídas — eso se guarda por usuario, no
--    globalmente (si tú ya la leíste, a otro compañero le sigue
--    apareciendo como nueva hasta que él también la abra).
-- ============================================================

-- 1) Tabla de notificaciones.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'general',
  title text not null,
  message text,
  -- NULL = para todos los roles.
  target_roles app_role[],
  link_path text,
  related_delivery_id uuid references public.deliveries (id) on delete set null,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- 2) Tabla de "leídas", una fila por usuario que ya vio cada una.
create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

-- 3) Cualquier rol válido ve las notificaciones dirigidas a "todos"
--    o específicamente a su rol.
drop policy if exists "Los roles ven sus notificaciones" on public.notifications;
create policy "Los roles ven sus notificaciones"
  on public.notifications for select
  using (
    public.current_user_role() is not null
    and (target_roles is null or public.current_user_role() = any (target_roles))
  );

-- 4) Cualquier rol válido puede crear una notificación (la usa la
--    función report_issue de abajo, y el propio update_delivery).
drop policy if exists "Los roles pueden crear notificaciones" on public.notifications;
create policy "Los roles pueden crear notificaciones"
  on public.notifications for insert
  with check (public.current_user_role() is not null);

-- 5) Cada quien solo ve y crea SUS PROPIAS marcas de "leído".
drop policy if exists "Cada quien ve sus propias lecturas" on public.notification_reads;
create policy "Cada quien ve sus propias lecturas"
  on public.notification_reads for select
  using (user_id = auth.uid());

drop policy if exists "Cada quien marca sus propias lecturas" on public.notification_reads;
create policy "Cada quien marca sus propias lecturas"
  on public.notification_reads for insert
  with check (user_id = auth.uid());

-- 6) Función para reportar un problema a mano. Le pone automáticamente
--    el nombre de quien reporta en el título.
create or replace function public.report_issue(p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_id uuid;
begin
  if public.current_user_role() is null then
    raise exception 'No tienes permiso para reportar un problema';
  end if;
  if p_message is null or trim(p_message) = '' then
    raise exception 'Escribe qué problema quieres reportar';
  end if;

  select full_name into v_full_name from public.profiles where id = auth.uid();

  insert into public.notifications (type, title, message, target_roles, created_by)
  values ('manual', 'Reporte de ' || coalesce(v_full_name, 'un empleado'), trim(p_message), null, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.report_issue(text) to authenticated;

-- 7) Marca notificaciones como leídas por el usuario actual.
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_reads (notification_id, user_id)
  values (p_notification_id, auth.uid())
  on conflict (notification_id, user_id) do nothing;
end;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_reads (notification_id, user_id)
  select n.id, auth.uid()
  from public.notifications n
  where public.current_user_role() is not null
    and (n.target_roles is null or public.current_user_role() = any (n.target_roles))
  on conflict (notification_id, user_id) do nothing;
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;

-- 8) update_delivery: cuando un reparto se marca como "incidencia"
--    (y no lo estaba ya), crea automáticamente una notificación para
--    todos, con un link directo a ese reparto.
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

  if p_status = 'incidencia' and v_delivery.status <> 'incidencia' then
    select * into v_sale from public.sales where id = v_delivery.sale_id;
    insert into public.notifications (type, title, message, target_roles, link_path, related_delivery_id, created_by)
    values (
      'reparto_incidencia',
      'Incidencia en reparto — ' || coalesce(v_sale.folio, ''),
      coalesce(v_sale.customer_name, 'Cliente') || ': ' || coalesce(p_notes, v_delivery.notes, 'Sin detalle'),
      null,
      '/repartos/' || p_delivery_id,
      p_delivery_id,
      auth.uid()
    );
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

notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la migración de notificaciones
-- ============================================================
