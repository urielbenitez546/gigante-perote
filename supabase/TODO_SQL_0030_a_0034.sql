
-- >>>>>>>>>> 0030_exhibicion_almacen_y_jefe.sql <<<<<<<<<<
-- ============================================================
-- Exhibición: todo Almacén puede registrar, y Gerencia o el
-- Jefe de almacén pueden confirmar
-- ============================================================
-- Es seguro correr este script más de una vez.
--
-- Qué cambia:
--  1) Todo Almacén (jefe, auxiliar y almacenistas) puede registrar
--     "Ya exhibí" / "Ya lo quité" con foto de evidencia.
--  2) Permiso nuevo "confirmar_exhibicion": Gerencia siempre; el Jefe
--     de almacén por defecto. Gerencia se lo puede dar o quitar a
--     cualquier persona en Administración.
--  3) Nadie confirma su propio registro (salvo Gerencia, que se
--     confirma sola). Lo que registre el Jefe lo confirma Gerencia.
--  4) El aviso de "Confirmar exhibición" llega a Gerencia y al Jefe.
-- ============================================================

-- 1) Permisos -----------------------------------------------------------------
create or replace function public.tiene_permiso(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_nivel text;
  v_perm jsonb;
  v_def boolean;
begin
  select role::text, nivel_almacen, permisos
    into v_role, v_nivel, v_perm
  from public.profiles
  where id = auth.uid() and active;

  if v_role is null then return false; end if;
  if v_role = 'gerencia' then return true; end if;
  if v_perm ? p_key then return coalesce((v_perm ->> p_key)::boolean, false); end if;

  v_def := case p_key
    when 'editar_precios'    then v_role = 'almacen' and v_nivel = 'jefe'
    when 'operar_almacen'    then v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar')
    when 'kardex'            then v_role = 'almacen'
    when 'kardex_entradas'   then v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar')
    when 'registrar_facturas' then v_role = 'almacen' and v_nivel = 'jefe'
    when 'dar_de_baja'       then v_role = 'almacen' and v_nivel = 'jefe'
    when 'corregir_cobros'   then v_role = 'caja'
    when 'confirmar_retiros' then v_role = 'ventas' or (v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar'))
    when 'pedir_exhibicion'  then v_role in ('ventas', 'almacen')
    when 'confirmar_exhibicion' then v_role = 'almacen' and v_nivel = 'jefe'
    when 'anular_kardex'     then v_role = 'almacen' and v_nivel = 'jefe'
    when 'ver_km'            then v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar')
    when 'programar_entregas' then v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar')
    else false
  end;
  return coalesce(v_def, false);
end;
$$;

grant execute on function public.tiene_permiso(text) to authenticated;

-- 2) Registrar una exhibición (el aviso llega a Gerencia y al Jefe) ----------
create or replace function public.solicitar_exhibicion(
  p_product_id uuid,
  p_tipo text,
  p_cantidad numeric default 0,
  p_muestra text default null,
  p_ubicacion text default null,
  p_notas text default null,
  p_photo_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role := public.current_user_role();
  v_p record;
  v_id uuid;
  v_nombre text;
begin
  if v_role not in ('gerencia', 'ventas', 'almacen') then
    raise exception 'Solo Ventas, Almacén y Gerencia registran exhibiciones';
  end if;
  if not public.tiene_permiso('pedir_exhibicion') then
    raise exception 'No tienes permiso para registrar exhibiciones';
  end if;
  if p_tipo not in ('exhibir', 'retirar') then
    raise exception 'Tipo inválido';
  end if;
  if coalesce(p_cantidad, 0) < 0 then
    raise exception 'La cantidad no puede ser negativa';
  end if;

  select * into v_p from public.products where id = p_product_id;
  if v_p is null then
    raise exception 'Producto no encontrado';
  end if;

  if p_tipo = 'exhibir' then
    if v_p.exhibido then
      raise exception '"%" ya está marcado como exhibido', v_p.name;
    end if;
    if p_photo_path is null then
      raise exception 'Toma una foto de cómo quedó la exhibición (es la evidencia para auditoría)';
    end if;
    if coalesce(p_cantidad, 0) > v_p.physical_stock - v_p.sold_pending then
      raise exception 'Solo hay % disponibles de "%" para la muestra', greatest(v_p.physical_stock - v_p.sold_pending, 0), v_p.name;
    end if;
  else
    if not v_p.exhibido then
      raise exception '"%" no está marcado como exhibido', v_p.name;
    end if;
  end if;

  if exists (select 1 from public.display_requests where product_id = p_product_id and estado = 'pendiente') then
    raise exception 'Ya hay un aviso pendiente de confirmar para "%"', v_p.name;
  end if;

  insert into public.display_requests (product_id, tipo, cantidad, muestra, ubicacion, notas, photo_path)
  values (p_product_id, p_tipo, coalesce(p_cantidad, 0), nullif(trim(p_muestra), ''), nullif(trim(p_ubicacion), ''),
          nullif(trim(p_notas), ''), p_photo_path)
  returning id into v_id;

  -- Lo que registra Gerencia se confirma solo.
  if v_role = 'gerencia' then
    perform public.aplicar_exhibicion(v_id);
    update public.display_requests
    set estado = 'confirmada', revisado_por = auth.uid(), revisado_at = now()
    where id = v_id;
  else
    select full_name into v_nombre from public.profiles where id = auth.uid();
    insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, related_product_id, related_display_request_id, created_by)
    values (
      'exhibicion_revision',
      'Confirmar exhibición — ' || v_p.name,
      coalesce(v_nombre, 'Un colaborador') || case when p_tipo = 'exhibir' then ' dice que ya lo EXHIBIÓ' else ' dice que ya lo QUITÓ' end ||
        coalesce(' en ' || nullif(trim(p_ubicacion), ''), '') || '. Revisa la foto y confirma.',
      array['gerencia', 'almacen']::app_role[],
      array['jefe'],
      '/inventario?tab=exhibicion',
      p_product_id,
      v_id,
      auth.uid()
    );
  end if;

  return v_id;
end;
$$;

grant execute on function public.solicitar_exhibicion(uuid, text, numeric, text, text, text, text) to authenticated;

-- 3) Confirmar o rechazar: Gerencia o quien tenga el permiso (Jefe) -------------
create or replace function public.revisar_exhibicion(
  p_request_id uuid,
  p_aprobar boolean,
  p_comentario text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r record;
  v_p record;
  v_rol app_role := public.current_user_role();
begin
  if v_rol is distinct from 'gerencia' and not public.tiene_permiso('confirmar_exhibicion') then
    raise exception 'Solo Gerencia o el Jefe de almacén confirman exhibiciones';
  end if;

  select * into v_r from public.display_requests where id = p_request_id for update;
  if v_r is null or v_r.estado <> 'pendiente' then
    raise exception 'Ese aviso ya fue revisado';
  end if;
  if v_rol is distinct from 'gerencia' and v_r.solicitado_por = auth.uid() then
    raise exception 'No puedes confirmar tu propio registro: debe revisarlo otra persona (Gerencia)';
  end if;
  if not p_aprobar and (p_comentario is null or trim(p_comentario) = '') then
    raise exception 'Escribe por qué se rechaza (ej. la foto no se ve, falta el precio)';
  end if;

  if p_aprobar then
    perform public.aplicar_exhibicion(p_request_id);
  else
    select * into v_p from public.products where id = v_r.product_id;
    insert into public.notifications (type, title, message, target_roles, link_path, related_product_id, related_display_request_id, created_by)
    values (
      'exhibicion_rechazada',
      'Exhibición rechazada — ' || v_p.name,
      'No se confirmó que se ' || case when v_r.tipo = 'exhibir' then 'exhibió' else 'quitó' end ||
        '. Motivo: ' || trim(p_comentario),
      array['ventas', 'almacen', 'gerencia']::app_role[],
      '/inventario?tab=exhibicion',
      v_r.product_id,
      p_request_id,
      auth.uid()
    );
  end if;

  update public.display_requests
  set estado = case when p_aprobar then 'confirmada' else 'rechazada' end,
      revisado_por = auth.uid(),
      revisado_at = now(),
      comentario_revision = nullif(trim(p_comentario), '')
  where id = p_request_id;
end;
$$;

grant execute on function public.revisar_exhibicion(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la migración 0030
-- ============================================================

-- >>>>>>>>>> 0031_almacenistas_confirman_carga.sql <<<<<<<<<<
-- ============================================================
-- Entregas de hoy: los almacenistas confirman la carga de lo inmediato
-- ============================================================
-- Es seguro correr este script más de una vez.
-- Antes solo confirmaban la carga el jefe, el auxiliar y Ventas. Ahora
-- también los almacenistas, porque ellos cargan y entregan el material.
-- La confirmación descuenta del inventario y queda en el Kardex.
-- ============================================================

create or replace function public.confirmar_entrega_inmediata(
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
  v_items jsonb;
  v_sale record;
  v_sale_item_id uuid;
  v_quantity numeric;
  v_remaining numeric;
  v_product_id uuid;
begin
  if public.current_user_role() not in ('gerencia', 'almacen') then
    raise exception 'No tienes permiso para confirmar entregas inmediatas';
  end if;
  -- Todo Almacén (también los almacenistas) confirma la carga de una entrega
  -- inmediata: son quienes cargan y entregan el material.

  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale.id is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_sale.liberada_almacen_at is null then
    raise exception 'Esta venta todavía está en Caja: espera a que Caja la pase a almacén';
  end if;

  if p_items is null then
    select jsonb_agg(jsonb_build_object('sale_item_id', id, 'quantity', quantity - delivered_quantity))
      into v_items
    from public.sale_items
    where sale_id = p_sale_id
      and coalesce(delivery_type, v_sale.delivery_type) = 'inmediata'
      and delivered_quantity < quantity;
  else
    v_items := p_items;
  end if;

  if v_items is null or jsonb_array_length(v_items) = 0 then
    raise exception 'No hay nada pendiente de entrega inmediata en esta venta';
  end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_sale_item_id := (v_item ->> 'sale_item_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;

    select (quantity - delivered_quantity), product_id
      into v_remaining, v_product_id
    from public.sale_items
    where id = v_sale_item_id and sale_id = p_sale_id
      and coalesce(delivery_type, v_sale.delivery_type) = 'inmediata';

    if v_remaining is null then
      raise exception 'Renglón de venta no encontrado';
    end if;
    if v_quantity <= 0 or v_quantity > v_remaining then
      raise exception 'Cantidad inválida (pendiente: %)', v_remaining;
    end if;

    update public.sale_items set delivered_quantity = delivered_quantity + v_quantity where id = v_sale_item_id;
    update public.products
    set physical_stock = physical_stock - v_quantity,
        sold_pending = sold_pending - v_quantity
    where id = v_product_id;
    insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
    values (v_product_id, 'salida', v_quantity, v_sale.folio, auth.uid());
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

grant execute on function public.confirmar_entrega_inmediata(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- >>>>>>>>>> 0032_kardex_foto_todo_almacen.sql <<<<<<<<<<
-- ============================================================
-- Foto de apoyo del Kardex: ahora la pueden subir y ver
-- Gerencia, todo almacén (jefe, auxiliar, almacenistas) y choferes.
-- ============================================================
-- Requiere haber corrido antes 0027. Es seguro correr más de una vez.

drop policy if exists "Kardex soporte: subir" on storage.objects;
create policy "Kardex soporte: subir"
  on storage.objects for insert
  with check (
    bucket_id = 'kardex-soporte'
    and public.current_user_role() in ('gerencia', 'almacen', 'reparto')
  );

drop policy if exists "Kardex soporte: ver" on storage.objects;
create policy "Kardex soporte: ver"
  on storage.objects for select
  using (
    bucket_id = 'kardex-soporte'
    and public.current_user_role() in ('gerencia', 'almacen', 'reparto')
  );

create or replace function public.kardex_adjuntar_foto(p_movement_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov record;
begin
  if public.current_user_role() not in ('gerencia', 'almacen', 'reparto') then
    raise exception 'No tienes permiso para adjuntar fotos al Kardex';
  end if;
  if p_path is null or trim(p_path) = '' then
    raise exception 'Falta la foto';
  end if;

  select id, type::text as tipo, foto_path into v_mov
  from public.inventory_movements where id = p_movement_id;
  if v_mov.id is null then
    raise exception 'Renglón del Kardex no encontrado';
  end if;
  if v_mov.tipo not in ('entrada', 'salida') then
    raise exception 'Solo las entradas y salidas llevan foto de apoyo';
  end if;
  if v_mov.foto_path is not null then
    raise exception 'Este renglón ya tiene foto de apoyo';
  end if;

  update public.inventory_movements set foto_path = trim(p_path) where id = p_movement_id;
end;
$$;

grant execute on function public.kardex_adjuntar_foto(uuid, text) to authenticated;

-- >>>>>>>>>> 0033_cobranza_historial_corte.sql <<<<<<<<<<
-- ============================================================
-- Cobranza y Corte de Caja: libro de pagos con Venta / Cobranza
-- ============================================================
-- Requiere haber corrido antes 0029. Es seguro correr más de una vez.
--
-- Qué agrega:
--  1) "sale_pagos": cada pago de una venta queda con su fecha, su método,
--     su recibo y quién lo registró (cobro en Caja, cobro del chofer y
--     abonos posteriores).
--  2) Venta o Cobranza se decide solo:
--       - pago el MISMO día de la venta  -> VENTA
--       - pago en un día posterior       -> COBRANZA
--     (da igual si lo recibió Caja o el chofer).
--  3) Los cobros que ya existían (Caja y chofer) se registran solos en el
--     libro, sin cambiar los botones actuales. El cobro del chofer, al
--     confirmarlo Caja, ahora SÍ baja el saldo de la venta.
--  4) Abonos, corregir un pago y anular un pago, siempre con bitácora.
--  5) Cortes de caja guardados (con aviso si después cambia algo).
-- ============================================================

-- 0) Fecha "de México" de un momento ----------------------------------------
create or replace function public.fecha_mx(p_ts timestamptz)
returns date
language sql
immutable
as $$
  select (p_ts at time zone 'America/Mexico_City')::date
$$;

-- 1) Libro de pagos -----------------------------------------------------------
create table if not exists public.sale_pagos (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  monto numeric(12, 2) not null check (monto > 0),
  metodo text,
  origen text not null check (origen in ('caja', 'chofer', 'abono')),
  -- Día en que el cliente pagó (decide si es venta o cobranza).
  fecha_pago date not null,
  -- Día en que el dinero entró a Caja (decide en qué corte cae).
  fecha_caja date not null,
  tipo text not null check (tipo in ('venta', 'cobranza')),
  tipo_manual boolean not null default false,
  recibo text,
  comentario text,
  delivery_id uuid references public.deliveries (id) on delete set null,
  registrado_por uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  editado boolean not null default false,
  anulado boolean not null default false,
  anulado_por uuid references auth.users (id),
  anulado_at timestamptz,
  anulado_motivo text
);

create index if not exists sale_pagos_sale_idx on public.sale_pagos (sale_id);
create index if not exists sale_pagos_fecha_caja_idx on public.sale_pagos (fecha_caja);
create unique index if not exists sale_pagos_un_cobro_por_reparto
  on public.sale_pagos (delivery_id) where origen = 'chofer' and not anulado;

-- 2) Bitácora de cambios ----------------------------------------------------------
create table if not exists public.sale_pagos_log (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.sale_pagos (id) on delete cascade,
  sale_id uuid not null,
  accion text not null check (accion in ('registro', 'correccion', 'anulacion')),
  antes jsonb,
  despues jsonb,
  motivo text,
  por uuid references auth.users (id) default auth.uid(),
  at timestamptz not null default now()
);

create index if not exists sale_pagos_log_pago_idx on public.sale_pagos_log (pago_id, at);

-- 3) Cortes guardados ------------------------------------------------------------------
create table if not exists public.cortes_caja (
  id uuid primary key default gen_random_uuid(),
  desde date not null,
  hasta date not null,
  ventas_total numeric(14, 2) not null default 0,
  ventas_n integer not null default 0,
  cobranza_total numeric(14, 2) not null default 0,
  cobranza_n integer not null default 0,
  por_metodo jsonb,
  huella text,
  nota text,
  creado_por uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (hasta >= desde)
);

-- 4) Quién puede ver qué -------------------------------------------------------------------
alter table public.sale_pagos enable row level security;
alter table public.sale_pagos_log enable row level security;
alter table public.cortes_caja enable row level security;

drop policy if exists "Caja y Gerencia ven los pagos" on public.sale_pagos;
create policy "Caja y Gerencia ven los pagos"
  on public.sale_pagos for select
  using (public.current_user_role() in ('gerencia', 'caja'));

drop policy if exists "Caja y Gerencia ven la bitacora de pagos" on public.sale_pagos_log;
create policy "Caja y Gerencia ven la bitacora de pagos"
  on public.sale_pagos_log for select
  using (public.current_user_role() in ('gerencia', 'caja'));

drop policy if exists "Caja y Gerencia ven los cortes" on public.cortes_caja;
create policy "Caja y Gerencia ven los cortes"
  on public.cortes_caja for select
  using (public.current_user_role() in ('gerencia', 'caja'));

-- 5) Funciones internas ---------------------------------------------------------------------
-- Deja en la venta lo pagado = suma de los pagos no anulados.
create or replace function public._recalcular_pagado(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.pagos_internos', '1', true);
  update public.sales
  set amount_paid = (
    select coalesce(sum(monto), 0) from public.sale_pagos
    where sale_id = p_sale_id and not anulado
  )
  where id = p_sale_id;
  perform set_config('app.pagos_internos', '0', true);
end;
$$;

revoke all on function public._recalcular_pagado(uuid) from public;

create or replace function public._insertar_pago(
  p_sale_id uuid,
  p_monto numeric,
  p_metodo text,
  p_origen text,
  p_fecha_pago date,
  p_fecha_caja date,
  p_recibo text,
  p_comentario text,
  p_delivery_id uuid,
  p_por uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha_venta date;
  v_tipo text;
  v_id uuid;
begin
  select public.fecha_mx(created_at) into v_fecha_venta from public.sales where id = p_sale_id;
  v_tipo := case when p_fecha_pago <= v_fecha_venta then 'venta' else 'cobranza' end;

  insert into public.sale_pagos
    (sale_id, monto, metodo, origen, fecha_pago, fecha_caja, tipo, recibo, comentario, delivery_id, registrado_por)
  values
    (p_sale_id, round(p_monto, 2), p_metodo, p_origen, p_fecha_pago, p_fecha_caja, v_tipo,
     nullif(trim(coalesce(p_recibo, '')), ''), nullif(trim(coalesce(p_comentario, '')), ''), p_delivery_id, p_por)
  returning id into v_id;

  insert into public.sale_pagos_log (pago_id, sale_id, accion, despues, por)
  select id, sale_id, 'registro', to_jsonb(p) - 'id', p_por from public.sale_pagos p where id = v_id;

  perform public._recalcular_pagado(p_sale_id);
  return v_id;
end;
$$;

revoke all on function public._insertar_pago(uuid, numeric, text, text, date, date, text, text, uuid, uuid) from public;

-- 6) Los cobros que ya existían se registran solos en el libro -----------------------------
-- 6a) Caja cobra / corrige desde Ventas (cambia sales.amount_paid).
create or replace function public.sync_pagos_desde_sales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suma numeric;
  v_diff numeric;
  v_caja record;
  v_hoy date := public.fecha_mx(now());
begin
  if coalesce(current_setting('app.pagos_internos', true), '0') = '1' then
    return new;
  end if;
  if new.amount_paid is not distinct from old.amount_paid then
    return new;
  end if;

  select coalesce(sum(monto), 0) into v_suma
  from public.sale_pagos where sale_id = new.id and not anulado;
  v_diff := round(new.amount_paid - v_suma, 2);
  if v_diff = 0 then
    return new;
  end if;

  select * into v_caja
  from public.sale_pagos
  where sale_id = new.id and origen = 'caja' and not anulado
  order by created_at
  limit 1;

  if v_caja.id is null then
    if v_diff < 0 then
      raise exception 'No hay un cobro en Caja que corregir en esta venta';
    end if;
    perform public._insertar_pago(new.id, v_diff, new.metodo_pago, 'caja', v_hoy, v_hoy, null, null, null, auth.uid());
  elsif v_caja.monto + v_diff > 0 then
    update public.sale_pagos
    set monto = monto + v_diff, metodo = coalesce(new.metodo_pago, metodo), editado = true
    where id = v_caja.id;
    insert into public.sale_pagos_log (pago_id, sale_id, accion, antes, despues, motivo)
    values (v_caja.id, new.id, 'correccion',
            jsonb_build_object('monto', v_caja.monto),
            jsonb_build_object('monto', v_caja.monto + v_diff),
            'Corrección del cobro hecha desde Ventas (el motivo está en el historial de la venta)');
  elsif v_caja.monto + v_diff = 0 then
    update public.sale_pagos
    set anulado = true, anulado_por = auth.uid(), anulado_at = now(),
        anulado_motivo = 'Cobro corregido a $0 desde Ventas'
    where id = v_caja.id;
    insert into public.sale_pagos_log (pago_id, sale_id, accion, antes, despues, motivo)
    values (v_caja.id, new.id, 'anulacion', jsonb_build_object('monto', v_caja.monto), null,
            'Cobro corregido a $0 desde Ventas');
  else
    raise exception 'Ese monto es menor a lo que ya se abonó después. Corrige o anula esos abonos desde Cobranza y Corte';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_pagos_desde_sales on public.sales;
create trigger sync_pagos_desde_sales
  after update of amount_paid on public.sales
  for each row execute function public.sync_pagos_desde_sales();

-- 6b) Caja confirma el cobro del chofer (Evidencias y Cobros).
create or replace function public.sync_pagos_desde_reparto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metodo text;
begin
  if old.payment_confirmed_at is not null or new.payment_confirmed_at is null then
    return new;
  end if;
  if coalesce(new.amount_collected, 0) <= 0 then
    return new;
  end if;
  if exists (select 1 from public.sale_pagos where delivery_id = new.id and origen = 'chofer' and not anulado) then
    return new;
  end if;
  v_metodo := new.payment_method::text;
  perform public._insertar_pago(
    new.sale_id,
    new.amount_collected,
    v_metodo,
    'chofer',
    public.fecha_mx(coalesce(new.delivered_at, new.payment_confirmed_at)),
    public.fecha_mx(new.payment_confirmed_at),
    null,
    new.payment_notes,
    new.id,
    coalesce(new.payment_confirmed_by, auth.uid())
  );
  return new;
end;
$$;

drop trigger if exists sync_pagos_desde_reparto on public.deliveries;
create trigger sync_pagos_desde_reparto
  after update of payment_confirmed_at on public.deliveries
  for each row execute function public.sync_pagos_desde_reparto();

-- 7) Abono posterior (Caja o Gerencia) ------------------------------------------------------
create or replace function public.registrar_abono(
  p_sale_id uuid,
  p_monto numeric,
  p_metodo text default null,
  p_recibo text default null,
  p_fecha date default null,
  p_comentario text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_hoy date := public.fecha_mx(now());
  v_fecha date;
  v_metodo text := nullif(trim(coalesce(p_metodo, '')), '');
  v_saldo numeric;
begin
  if public.current_user_role() not in ('gerencia', 'caja') then
    raise exception 'Solo Caja o Gerencia pueden registrar abonos';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_sale.status = 'cancelada' then
    raise exception 'La venta está cancelada';
  end if;
  if v_sale.liberada_almacen_at is null then
    raise exception 'Esta venta todavía está esperando su primer cobro: usa "Confirmar cobro" en Ventas';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'Escribe un monto mayor a cero';
  end if;
  v_saldo := round(v_sale.total - v_sale.amount_paid, 2);
  if round(p_monto, 2) > v_saldo then
    raise exception 'El abono ($%) es mayor al saldo de la venta ($%)', round(p_monto, 2), v_saldo;
  end if;
  v_fecha := coalesce(p_fecha, v_hoy);
  if v_fecha > v_hoy then
    raise exception 'La fecha del abono no puede ser futura';
  end if;
  if v_fecha < public.fecha_mx(v_sale.created_at) then
    raise exception 'La fecha del abono no puede ser anterior a la venta';
  end if;
  if v_metodo is not null and v_metodo not in ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'tarjeta', 'transferencia', 'a_meses') then
    raise exception 'Método de pago no válido';
  end if;

  return public._insertar_pago(p_sale_id, p_monto, v_metodo, 'abono', v_fecha, v_fecha, p_recibo, p_comentario, null, auth.uid());
end;
$$;

grant execute on function public.registrar_abono(uuid, numeric, text, text, date, text) to authenticated;

-- 8) Corregir un pago (con motivo) -----------------------------------------------------------
create or replace function public.corregir_pago(
  p_pago_id uuid,
  p_monto numeric,
  p_metodo text,
  p_recibo text,
  p_fecha_pago date,
  p_fecha_caja date,
  p_tipo text,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
  v_sale record;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_otros numeric;
  v_monto numeric;
  v_fp date;
  v_fc date;
  v_tipo text;
  v_manual boolean;
  v_hoy date := public.fecha_mx(now());
  v_rol text := public.current_user_role();
begin
  if v_rol not in ('gerencia', 'caja') or not public.tiene_permiso('corregir_cobros') then
    raise exception 'No tienes permiso para corregir pagos';
  end if;
  if v_motivo is null then
    raise exception 'Escribe el motivo de la corrección';
  end if;

  select * into v_p from public.sale_pagos where id = p_pago_id for update;
  if v_p.id is null then
    raise exception 'Pago no encontrado';
  end if;
  if v_p.anulado then
    raise exception 'Este pago ya está anulado';
  end if;
  select * into v_sale from public.sales where id = v_p.sale_id for update;

  v_monto := round(coalesce(p_monto, v_p.monto), 2);
  if v_monto <= 0 then
    raise exception 'El monto debe ser mayor a cero. Si el pago no existe, anúlalo';
  end if;
  select coalesce(sum(monto), 0) into v_otros
  from public.sale_pagos where sale_id = v_p.sale_id and not anulado and id <> v_p.id;
  if v_otros + v_monto > v_sale.total + 0.005 then
    raise exception 'Con ese monto lo pagado ($%) pasa del total de la venta ($%)', v_otros + v_monto, v_sale.total;
  end if;

  v_fp := coalesce(p_fecha_pago, v_p.fecha_pago);
  v_fc := coalesce(p_fecha_caja, v_p.fecha_caja);
  if v_fp > v_hoy or v_fc > v_hoy then
    raise exception 'Las fechas no pueden ser futuras';
  end if;
  if v_fp < public.fecha_mx(v_sale.created_at) then
    raise exception 'La fecha de pago no puede ser anterior a la venta';
  end if;

  if p_tipo is not null and p_tipo not in ('venta', 'cobranza') then
    raise exception 'El tipo debe ser venta o cobranza';
  end if;
  if p_tipo is not null and p_tipo <> v_p.tipo then
    v_tipo := p_tipo;
    v_manual := true;
  elsif v_p.tipo_manual then
    v_tipo := v_p.tipo;
    v_manual := true;
  else
    v_tipo := case when v_fp <= public.fecha_mx(v_sale.created_at) then 'venta' else 'cobranza' end;
    v_manual := false;
  end if;

  if v_monto = v_p.monto
     and v_fp = v_p.fecha_pago and v_fc = v_p.fecha_caja
     and v_tipo = v_p.tipo
     and nullif(trim(coalesce(p_metodo, '')), '') is not distinct from v_p.metodo
     and nullif(trim(coalesce(p_recibo, '')), '') is not distinct from v_p.recibo then
    raise exception 'No hay nada que corregir: los datos son los mismos';
  end if;

  update public.sale_pagos
  set monto = v_monto,
      metodo = coalesce(nullif(trim(coalesce(p_metodo, '')), ''), metodo),
      recibo = nullif(trim(coalesce(p_recibo, '')), ''),
      fecha_pago = v_fp,
      fecha_caja = v_fc,
      tipo = v_tipo,
      tipo_manual = v_manual,
      editado = true
  where id = p_pago_id;

  insert into public.sale_pagos_log (pago_id, sale_id, accion, antes, despues, motivo)
  select p_pago_id, v_p.sale_id, 'correccion',
         jsonb_build_object('monto', v_p.monto, 'metodo', v_p.metodo, 'recibo', v_p.recibo,
                            'fecha_pago', v_p.fecha_pago, 'fecha_caja', v_p.fecha_caja, 'tipo', v_p.tipo),
         jsonb_build_object('monto', n.monto, 'metodo', n.metodo, 'recibo', n.recibo,
                            'fecha_pago', n.fecha_pago, 'fecha_caja', n.fecha_caja, 'tipo', n.tipo),
         v_motivo
  from public.sale_pagos n where n.id = p_pago_id;

  perform public._recalcular_pagado(v_p.sale_id);

  if v_rol <> 'gerencia' then
    insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, related_sale_id, created_by)
    values (
      'cobro_corregido',
      'Pago corregido — ' || v_sale.folio,
      v_sale.customer_name || ': de $' || to_char(v_p.monto, 'FM999,999,990.00') ||
        ' a $' || to_char(v_monto, 'FM999,999,990.00') || '. Motivo: ' || v_motivo,
      array['gerencia']::app_role[], null, '/cobranza', v_p.sale_id, auth.uid()
    );
  end if;
end;
$$;

grant execute on function public.corregir_pago(uuid, numeric, text, text, date, date, text, text) to authenticated;

-- 9) Anular un pago (con motivo) ------------------------------------------------------------------
create or replace function public.anular_pago(p_pago_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
  v_sale record;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_rol text := public.current_user_role();
begin
  if v_rol not in ('gerencia', 'caja') or not public.tiene_permiso('corregir_cobros') then
    raise exception 'No tienes permiso para anular pagos';
  end if;
  if v_motivo is null then
    raise exception 'Escribe el motivo';
  end if;

  select * into v_p from public.sale_pagos where id = p_pago_id for update;
  if v_p.id is null then
    raise exception 'Pago no encontrado';
  end if;
  if v_p.anulado then
    raise exception 'Este pago ya está anulado';
  end if;
  select * into v_sale from public.sales where id = v_p.sale_id for update;

  update public.sale_pagos
  set anulado = true, anulado_por = auth.uid(), anulado_at = now(), anulado_motivo = v_motivo
  where id = p_pago_id;

  insert into public.sale_pagos_log (pago_id, sale_id, accion, antes, despues, motivo)
  values (p_pago_id, v_p.sale_id, 'anulacion',
          jsonb_build_object('monto', v_p.monto, 'metodo', v_p.metodo, 'recibo', v_p.recibo,
                             'fecha_pago', v_p.fecha_pago, 'tipo', v_p.tipo),
          null, v_motivo);

  perform public._recalcular_pagado(v_p.sale_id);

  if v_rol <> 'gerencia' then
    insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, related_sale_id, created_by)
    values (
      'cobro_corregido',
      'Pago anulado — ' || v_sale.folio,
      v_sale.customer_name || ': se anuló un pago de $' || to_char(v_p.monto, 'FM999,999,990.00') ||
        '. Motivo: ' || v_motivo,
      array['gerencia']::app_role[], null, '/cobranza', v_p.sale_id, auth.uid()
    );
  end if;
end;
$$;

grant execute on function public.anular_pago(uuid, text) to authenticated;

-- 10) Cortes de caja ---------------------------------------------------------------------------------
-- Huella del rango: cambia si se agrega, corrige o anula cualquier pago de esos días.
create or replace function public._huella_corte(p_desde date, p_hasta date)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select md5(coalesce(string_agg(
    id::text || '|' || monto::text || '|' || tipo || '|' || fecha_caja::text || '|' || anulado::text,
    ',' order by id
  ), ''))
  from public.sale_pagos
  where fecha_caja between p_desde and p_hasta
$$;

revoke all on function public._huella_corte(date, date) from public;

create or replace function public.guardar_corte(p_desde date, p_hasta date, p_nota text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_metodos jsonb;
begin
  if public.current_user_role() not in ('gerencia', 'caja') then
    raise exception 'Solo Caja o Gerencia pueden guardar un corte';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Revisa las fechas del corte';
  end if;

  select coalesce(jsonb_object_agg(m, jsonb_build_object('venta', v, 'cobranza', c)), '{}'::jsonb)
  into v_metodos
  from (
    select coalesce(metodo, 'sin_metodo') as m,
           coalesce(sum(monto) filter (where tipo = 'venta'), 0) as v,
           coalesce(sum(monto) filter (where tipo = 'cobranza'), 0) as c
    from public.sale_pagos
    where fecha_caja between p_desde and p_hasta and not anulado
    group by 1
  ) x;

  insert into public.cortes_caja
    (desde, hasta, ventas_total, ventas_n, cobranza_total, cobranza_n, por_metodo, huella, nota)
  select p_desde, p_hasta,
         coalesce(sum(monto) filter (where tipo = 'venta'), 0),
         count(*) filter (where tipo = 'venta'),
         coalesce(sum(monto) filter (where tipo = 'cobranza'), 0),
         count(*) filter (where tipo = 'cobranza'),
         v_metodos,
         public._huella_corte(p_desde, p_hasta),
         nullif(trim(coalesce(p_nota, '')), '')
  from public.sale_pagos
  where fecha_caja between p_desde and p_hasta and not anulado
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.guardar_corte(date, date, text) to authenticated;

-- Lista los cortes guardados y dice cuáles cambiaron después de guardarse.
create or replace function public.cortes_con_estado()
returns table (
  id uuid,
  desde date,
  hasta date,
  ventas_total numeric,
  ventas_n integer,
  cobranza_total numeric,
  cobranza_n integer,
  nota text,
  creado_por uuid,
  created_at timestamptz,
  modificado boolean,
  ventas_actual numeric,
  cobranza_actual numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('gerencia', 'caja') then
    raise exception 'Sin permiso';
  end if;
  return query
  select c.id, c.desde, c.hasta, c.ventas_total, c.ventas_n, c.cobranza_total, c.cobranza_n,
         c.nota, c.creado_por, c.created_at,
         c.huella is distinct from public._huella_corte(c.desde, c.hasta),
         coalesce((select sum(p.monto) from public.sale_pagos p
                   where p.fecha_caja between c.desde and c.hasta and not p.anulado and p.tipo = 'venta'), 0),
         coalesce((select sum(p.monto) from public.sale_pagos p
                   where p.fecha_caja between c.desde and c.hasta and not p.anulado and p.tipo = 'cobranza'), 0)
  from public.cortes_caja c
  order by c.created_at desc
  limit 60;
end;
$$;

grant execute on function public.cortes_con_estado() to authenticated;

-- 11) Pagos que ya existían: se pasan al libro una sola vez ------------------------------------------
do $$
declare
  r record;
  v_suma numeric;
  v_monto numeric;
begin
  perform set_config('app.pagos_internos', '1', true);

  -- Lo que Caja ya había cobrado.
  for r in
    select s.id, s.amount_paid, s.metodo_pago, s.created_at, s.payment_confirmed_at, s.payment_confirmed_by
    from public.sales s
    where s.amount_paid > 0
      and not exists (select 1 from public.sale_pagos p where p.sale_id = s.id)
  loop
    insert into public.sale_pagos
      (sale_id, monto, metodo, origen, fecha_pago, fecha_caja, tipo, registrado_por, created_at)
    values (
      r.id, r.amount_paid, r.metodo_pago, 'caja',
      public.fecha_mx(coalesce(r.payment_confirmed_at, r.created_at)),
      public.fecha_mx(coalesce(r.payment_confirmed_at, r.created_at)),
      case when public.fecha_mx(coalesce(r.payment_confirmed_at, r.created_at)) <= public.fecha_mx(r.created_at)
           then 'venta' else 'cobranza' end,
      r.payment_confirmed_by,
      coalesce(r.payment_confirmed_at, r.created_at)
    );
  end loop;

  -- Lo que los choferes cobraron y Caja ya confirmó (sin pasar del total de la venta).
  for r in
    select d.id as delivery_id, d.sale_id, d.amount_collected, d.payment_method::text as metodo,
           d.delivered_at, d.payment_confirmed_at, d.payment_confirmed_by, d.payment_notes,
           s.total, s.created_at as venta_at
    from public.deliveries d
    join public.sales s on s.id = d.sale_id
    where d.payment_confirmed_at is not null
      and coalesce(d.amount_collected, 0) > 0
      and not exists (select 1 from public.sale_pagos p where p.delivery_id = d.id and p.origen = 'chofer')
    order by d.payment_confirmed_at
  loop
    select coalesce(sum(monto), 0) into v_suma from public.sale_pagos where sale_id = r.sale_id and not anulado;
    v_monto := least(r.amount_collected, r.total - v_suma);
    if v_monto > 0 then
      insert into public.sale_pagos
        (sale_id, monto, metodo, origen, fecha_pago, fecha_caja, tipo, comentario, delivery_id, registrado_por, created_at)
      values (
        r.sale_id, v_monto, r.metodo, 'chofer',
        public.fecha_mx(coalesce(r.delivered_at, r.payment_confirmed_at)),
        public.fecha_mx(r.payment_confirmed_at),
        case when public.fecha_mx(coalesce(r.delivered_at, r.payment_confirmed_at)) <= public.fecha_mx(r.venta_at)
             then 'venta' else 'cobranza' end,
        r.payment_notes, r.delivery_id, r.payment_confirmed_by, r.payment_confirmed_at
      );
    end if;
  end loop;

  update public.sales s
  set amount_paid = (select coalesce(sum(monto), 0) from public.sale_pagos p where p.sale_id = s.id and not p.anulado)
  where exists (select 1 from public.sale_pagos p where p.sale_id = s.id);

  perform set_config('app.pagos_internos', '0', true);
end;
$$;


-- 12) Ventas que todavía tienen saldo por cobrar (para la pantalla "Por cobrar") -----------------------
create or replace view public.ventas_con_saldo
with (security_invoker = true) as
select s.*
from public.sales s
where s.status <> 'cancelada'
  and s.liberada_almacen_at is not null
  and round(s.total - s.amount_paid, 2) > 0;

grant select on public.ventas_con_saldo to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la migración 0033
-- ============================================================

-- >>>>>>>>>> 0034_foto_del_producto.sql <<<<<<<<<<
-- ============================================================
-- Foto del producto: aparece junto al nombre en el Kardex y en la
-- ficha del producto, para que se vea si el material coincide.
-- ============================================================
-- Es seguro correr este script más de una vez.
--  - Gerencia, todo almacén y choferes pueden poner o cambiar la foto.
--  - Todos los usuarios con sesión la pueden ver (bucket público de lectura).

alter table public.products add column if not exists foto_path text;

insert into storage.buckets (id, name, public)
values ('productos-fotos', 'productos-fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "Fotos de productos: subir" on storage.objects;
create policy "Fotos de productos: subir"
  on storage.objects for insert
  with check (
    bucket_id = 'productos-fotos'
    and public.current_user_role() in ('gerencia', 'almacen', 'reparto')
  );

drop policy if exists "Fotos de productos: ver" on storage.objects;
create policy "Fotos de productos: ver"
  on storage.objects for select
  using (bucket_id = 'productos-fotos');

-- Guarda (o cambia) la foto de un producto.
-- p_solo_si_no_tiene = true: si el producto ya tiene foto, no la cambia.
create or replace function public.producto_guardar_foto(
  p_product_id uuid,
  p_path text,
  p_solo_si_no_tiene boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('gerencia', 'almacen', 'reparto') then
    raise exception 'No tienes permiso para cambiar la foto del producto';
  end if;
  if p_path is null or trim(p_path) = '' then
    raise exception 'Falta la foto';
  end if;

  update public.products
     set foto_path = trim(p_path)
   where id = p_product_id
     and (not p_solo_si_no_tiene or foto_path is null);

  if not found and not p_solo_si_no_tiene then
    raise exception 'Producto no encontrado';
  end if;
end;
$$;

grant execute on function public.producto_guardar_foto(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
