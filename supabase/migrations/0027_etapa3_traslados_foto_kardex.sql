-- ============================================================
-- Etapa 3: Traslados a otras sucursales, solicitudes con respuesta
--          de vendedores y foto de apoyo en el Kardex
-- ============================================================
-- Requiere haber corrido antes 0025 y 0026.
-- Es seguro correr este script más de una vez.
--
-- Qué agrega:
--  1) Foto de apoyo en cada renglón del Kardex (bucket PRIVADO
--     "kardex-soporte"; solo jefe, auxiliar y Gerencia suben y ven).
--  2) Un traslado a otra sucursal es una salida del Kardex con destino.
--  3) Solicitudes de sucursal ("la sucursal X pide 190 cajas"): avisan a
--     Ventas, los vendedores responden "ya vendí / ya comprometí" y el
--     sistema calcula cuánto queda libre para trasladar.
-- ============================================================

-- 1) Columnas nuevas en el Kardex --------------------------------------------
alter table public.inventory_movements add column if not exists foto_path text;
alter table public.inventory_movements add column if not exists destino text;

-- 2) Bucket privado para las fotos de apoyo ----------------------------------
insert into storage.buckets (id, name, public)
values ('kardex-soporte', 'kardex-soporte', false)
on conflict (id) do nothing;

drop policy if exists "Kardex soporte: subir" on storage.objects;
create policy "Kardex soporte: subir"
  on storage.objects for insert
  with check (bucket_id = 'kardex-soporte' and public.tiene_permiso('operar_almacen'));

drop policy if exists "Kardex soporte: ver" on storage.objects;
create policy "Kardex soporte: ver"
  on storage.objects for select
  using (bucket_id = 'kardex-soporte' and public.tiene_permiso('operar_almacen'));

-- 3) Adjuntar la foto a un renglón (solo si todavía no tenía una) -------------
create or replace function public.kardex_adjuntar_foto(p_movement_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov record;
begin
  if not public.tiene_permiso('operar_almacen') then
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

-- 4) Solicitudes de traslado ----------------------------------------------------
create table if not exists public.solicitudes_traslado (
  id uuid primary key default gen_random_uuid(),
  sucursal text not null,
  product_id uuid not null references public.products (id),
  cantidad numeric not null check (cantidad > 0),
  nota text,
  estado text not null default 'abierta' check (estado in ('abierta', 'atendida', 'cancelada')),
  cantidad_enviada numeric,
  movimiento_id uuid references public.inventory_movements (id),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  cerrada_por uuid references auth.users (id),
  cerrada_at timestamptz,
  motivo_cierre text
);

create table if not exists public.solicitud_traslado_respuestas (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_traslado (id) on delete cascade,
  tipo text not null check (tipo in ('ya_vendi', 'ya_comprometi', 'sin_compromiso')),
  cantidad numeric not null default 0 check (cantidad >= 0),
  nota text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (solicitud_id, created_by)
);

alter table public.solicitudes_traslado enable row level security;
alter table public.solicitud_traslado_respuestas enable row level security;

drop policy if exists "Ver solicitudes de traslado" on public.solicitudes_traslado;
create policy "Ver solicitudes de traslado"
  on public.solicitudes_traslado for select
  using (public.current_user_role() in ('gerencia', 'almacen', 'ventas'));

drop policy if exists "Ver respuestas de traslado" on public.solicitud_traslado_respuestas;
create policy "Ver respuestas de traslado"
  on public.solicitud_traslado_respuestas for select
  using (public.current_user_role() in ('gerencia', 'almacen', 'ventas'));

-- 5) Crear la solicitud: avisa a Ventas, Gerencia y jefe/auxiliar ---------------
create or replace function public.crear_solicitud_traslado(
  p_sucursal text,
  p_product_id uuid,
  p_cantidad numeric,
  p_nota text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
  v_unit text;
  v_sucursal text := nullif(trim(coalesce(p_sucursal, '')), '');
begin
  if not public.tiene_permiso('operar_almacen') then
    raise exception 'No tienes permiso para crear solicitudes de traslado';
  end if;
  if v_sucursal is null then
    raise exception 'Escribe qué sucursal lo pide';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  select code, name, unit::text into v_code, v_name, v_unit from public.products where id = p_product_id;
  if v_code is null then
    raise exception 'Producto no encontrado';
  end if;

  insert into public.solicitudes_traslado (sucursal, product_id, cantidad, nota)
  values (v_sucursal, p_product_id, p_cantidad, nullif(trim(coalesce(p_nota, '')), ''))
  returning id into v_id;

  insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, created_by)
  values (
    'solicitud_traslado',
    'Sucursal ' || v_sucursal || ' pide material',
    'Pide ' || trim(to_char(p_cantidad, 'FM999,999,990.99'), '.') || ' ' || v_unit || ' de ' || v_code || ' — ' || v_name ||
      '. Si ya vendiste o comprometiste de este material, avísalo para no quedar mal con tu cliente.',
    array['ventas', 'gerencia', 'almacen']::app_role[],
    array['jefe', 'auxiliar'],
    '/traslados',
    auth.uid()
  );

  return v_id;
end;
$$;

grant execute on function public.crear_solicitud_traslado(text, uuid, numeric, text) to authenticated;

-- 6) Respuesta de un vendedor ("ya vendí" / "ya comprometí" / "nada") ------------
create or replace function public.responder_solicitud_traslado(
  p_solicitud_id uuid,
  p_tipo text,
  p_cantidad numeric default 0,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_cant numeric := coalesce(p_cantidad, 0);
begin
  if public.current_user_role() not in ('ventas', 'gerencia') then
    raise exception 'Solo Ventas y Gerencia responden las solicitudes de traslado';
  end if;
  if p_tipo not in ('ya_vendi', 'ya_comprometi', 'sin_compromiso') then
    raise exception 'Respuesta no válida';
  end if;

  select estado into v_estado from public.solicitudes_traslado where id = p_solicitud_id;
  if v_estado is null then
    raise exception 'Solicitud no encontrada';
  end if;
  if v_estado <> 'abierta' then
    raise exception 'Esta solicitud ya está cerrada';
  end if;

  if p_tipo = 'sin_compromiso' then
    v_cant := 0;
  elsif v_cant <= 0 then
    raise exception 'Escribe cuánto vendiste o comprometiste';
  end if;

  insert into public.solicitud_traslado_respuestas (solicitud_id, tipo, cantidad, nota)
  values (p_solicitud_id, p_tipo, v_cant, nullif(trim(coalesce(p_nota, '')), ''))
  on conflict (solicitud_id, created_by)
  do update set tipo = excluded.tipo, cantidad = excluded.cantidad, nota = excluded.nota, created_at = now();
end;
$$;

grant execute on function public.responder_solicitud_traslado(uuid, text, numeric, text) to authenticated;

-- 7) Registrar el traslado: salida del Kardex con destino ------------------------
--    Puede ir ligado a una solicitud (la cierra) o ser un traslado directo.
create or replace function public.registrar_traslado(
  p_product_id uuid,
  p_sucursal text,
  p_cantidad numeric,
  p_nota text default null,
  p_solicitud_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod record;
  v_sol record;
  v_mov uuid;
  v_sucursal text := nullif(trim(coalesce(p_sucursal, '')), '');
  v_disponible numeric;
begin
  if not public.tiene_permiso('operar_almacen') then
    raise exception 'No tienes permiso para registrar traslados';
  end if;
  if v_sucursal is null then
    raise exception 'Escribe a qué sucursal va';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  select id, physical_stock, sold_pending into v_prod from public.products where id = p_product_id for update;
  if v_prod.id is null then
    raise exception 'Producto no encontrado';
  end if;
  v_disponible := v_prod.physical_stock - v_prod.sold_pending;
  if p_cantidad > v_disponible then
    raise exception 'Solo hay % disponibles (existencia % menos % ya apartado en ventas)',
      v_disponible, v_prod.physical_stock, v_prod.sold_pending;
  end if;

  if p_solicitud_id is not null then
    select * into v_sol from public.solicitudes_traslado where id = p_solicitud_id for update;
    if v_sol.id is null then
      raise exception 'Solicitud no encontrada';
    end if;
    if v_sol.estado <> 'abierta' then
      raise exception 'Esta solicitud ya está cerrada';
    end if;
    if v_sol.product_id <> p_product_id then
      raise exception 'El producto no coincide con la solicitud';
    end if;
  end if;

  insert into public.inventory_movements (product_id, type, quantity, reference, destino, created_by)
  values (
    p_product_id, 'salida', p_cantidad,
    'Traslado a ' || v_sucursal || coalesce(' · ' || nullif(trim(coalesce(p_nota, '')), ''), ''),
    v_sucursal, auth.uid()
  )
  returning id into v_mov;

  update public.products set physical_stock = physical_stock - p_cantidad where id = p_product_id;

  if p_solicitud_id is not null then
    update public.solicitudes_traslado
    set estado = 'atendida', cantidad_enviada = p_cantidad, movimiento_id = v_mov,
        cerrada_por = auth.uid(), cerrada_at = now()
    where id = p_solicitud_id;
  end if;

  return v_mov;
end;
$$;

grant execute on function public.registrar_traslado(uuid, text, numeric, text, uuid) to authenticated;

-- 8) Cancelar una solicitud ---------------------------------------------------------
create or replace function public.cancelar_solicitud_traslado(p_solicitud_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tiene_permiso('operar_almacen') then
    raise exception 'No tienes permiso para cancelar solicitudes de traslado';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'Escribe el motivo de la cancelación';
  end if;

  update public.solicitudes_traslado
  set estado = 'cancelada', cerrada_por = auth.uid(), cerrada_at = now(), motivo_cierre = trim(p_motivo)
  where id = p_solicitud_id and estado = 'abierta';

  if not found then
    raise exception 'Solicitud no encontrada o ya cerrada';
  end if;
end;
$$;

grant execute on function public.cancelar_solicitud_traslado(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la migración de la Etapa 3
-- ============================================================
