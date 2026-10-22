-- ============================================================
-- Etapa 1: Kardex anulable, Kardex para el chofer y resumen de km
-- ============================================================

-- 1) Dos permisos nuevos en tiene_permiso():
--    anular_kardex : anular renglones del Kardex (jefe de almacén y Gerencia)
--    ver_km        : ver repartos y el resumen de kilometraje (jefe, auxiliar y Gerencia)
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
    when 'corregir_cobros'   then false
    when 'confirmar_retiros' then v_role = 'ventas' or (v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar'))
    when 'pedir_exhibicion'  then v_role = 'ventas' or (v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar'))
    when 'anular_kardex'     then v_role = 'almacen' and v_nivel = 'jefe'
    when 'ver_km'            then v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar')
    else false
  end;
  return coalesce(v_def, false);
end;
$$;

grant execute on function public.tiene_permiso(text) to authenticated;

-- 2) El chofer (Reparto) puede CONSULTAR el Kardex (solo lectura).
drop policy if exists "Reparto puede ver movimientos" on public.inventory_movements;
create policy "Reparto puede ver movimientos"
  on public.inventory_movements for select
  using (public.current_user_role() = 'reparto');

drop policy if exists "Reparto puede ver conteos" on public.inventory_counts;
create policy "Reparto puede ver conteos"
  on public.inventory_counts for select
  using (public.current_user_role() = 'reparto');

-- 3) Jefe y auxiliar (o quien tenga ver_km) pueden ver los repartos
--    para el resumen de kilometraje.
drop policy if exists "Quien tenga ver_km puede ver repartos" on public.deliveries;
create policy "Quien tenga ver_km puede ver repartos"
  on public.deliveries for select
  using (public.tiene_permiso('ver_km'));

-- 4) Anular un renglón del Kardex (no se borra: queda tachado con quién y por qué).
alter table public.inventory_movements
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references auth.users (id),
  add column if not exists anulado_motivo text;

create or replace function public.anular_movimiento_kardex(p_movement_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov record;
  v_stock numeric;
begin
  if not public.tiene_permiso('anular_kardex') then
    raise exception 'No tienes permiso para anular renglones del Kardex';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Escribe el motivo de la anulación';
  end if;

  select * into v_mov from public.inventory_movements where id = p_movement_id for update;
  if not found then
    raise exception 'Ese renglón no existe';
  end if;
  if v_mov.anulado_at is not null then
    raise exception 'Ese renglón ya estaba anulado';
  end if;
  if v_mov.type::text not in ('entrada', 'salida') then
    raise exception 'Solo se pueden anular entradas y salidas del Kardex';
  end if;

  select physical_stock into v_stock from public.products where id = v_mov.product_id for update;

  if v_mov.type::text = 'entrada' then
    if v_stock < v_mov.quantity then
      raise exception 'No se puede anular: ya salió parte de ese material (existencia %).', v_stock;
    end if;
    update public.products set physical_stock = physical_stock - v_mov.quantity where id = v_mov.product_id;
  else
    update public.products set physical_stock = physical_stock + v_mov.quantity where id = v_mov.product_id;
  end if;

  update public.inventory_movements
     set anulado_at = now(), anulado_por = auth.uid(), anulado_motivo = trim(p_motivo)
   where id = p_movement_id;
end;
$$;

grant execute on function public.anular_movimiento_kardex(uuid, text) to authenticated;

notify pgrst, 'reload schema';
