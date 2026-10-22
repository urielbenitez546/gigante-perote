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
