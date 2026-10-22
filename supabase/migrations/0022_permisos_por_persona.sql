-- ============================================================
-- Permisos por persona (Gerencia los activa / desactiva)
-- ============================================================
-- Ejecuta en: Supabase > SQL Editor > New query
-- (después de 0021_niveles_almacen.sql)
--
-- Cada persona parte de lo que le toca por su rol y nivel; Gerencia
-- puede prender o apagar permisos sueltos desde Administración. Solo
-- se guarda lo que Gerencia cambió (en profiles.permisos). Gerencia
-- siempre tiene todo.
-- ============================================================

alter table public.profiles
  add column if not exists permisos jsonb not null default '{}'::jsonb;

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
    when 'confirmar_retiros' then v_role = 'ventas' or (v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar'))
    when 'pedir_exhibicion'  then v_role = 'ventas' or (v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar'))
    else false
  end;
  return coalesce(v_def, false);
end;
$$;

grant execute on function public.tiene_permiso(text) to authenticated;

-- Editar productos (precio, rotación, datos de etiqueta)
drop policy if exists "Gerencia y Jefe de almacen pueden actualizar productos" on public.products;
drop policy if exists "Gerencia y Almacen pueden actualizar productos" on public.products;
create policy "Quien tenga permiso puede actualizar productos"
  on public.products for update
  using (public.tiene_permiso('editar_precios'));

-- Dar de baja material
create or replace function public.register_write_off(
  p_product_id uuid, p_quantity numeric, p_reason text, p_photo_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
begin
  if not public.tiene_permiso('operar_almacen') then
    raise exception 'No tienes permiso para dar de baja material';
  end if;
  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Debes explicar el motivo de la baja';
  end if;

  select physical_stock into v_stock from public.products where id = p_product_id;
  if v_stock is null then
    raise exception 'Producto no encontrado';
  end if;
  if p_quantity > v_stock then
    raise exception 'No puedes dar de baja más de lo que hay en existencia física (%)', v_stock;
  end if;

  update public.products set physical_stock = physical_stock - p_quantity where id = p_product_id;

  insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
  values (p_product_id, 'merma', p_quantity, p_reason, auth.uid());

  insert into public.material_write_offs (product_id, quantity, reason, photo_path, created_by)
  values (p_product_id, p_quantity, p_reason, p_photo_path, auth.uid());
end;
$$;

-- Entradas de mercancía (Kardex o Inventario)
create or replace function public.register_inventory_entry(
  p_product_id uuid, p_quantity numeric, p_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.tiene_permiso('kardex') or public.tiene_permiso('operar_almacen')) then
    raise exception 'No tienes permiso para registrar entradas de inventario';
  end if;
  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
  values (p_product_id, 'entrada', p_quantity, p_reference, auth.uid());

  update public.products set physical_stock = physical_stock + p_quantity where id = p_product_id;
end;
$$;

-- Salidas manuales (Kardex o Inventario)
create or replace function public.register_inventory_salida(
  p_product_id uuid, p_quantity numeric, p_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
begin
  if not (public.tiene_permiso('kardex') or public.tiene_permiso('operar_almacen')) then
    raise exception 'No tienes permiso para registrar salidas de inventario';
  end if;
  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;
  if p_reference is null or trim(p_reference) = '' then
    raise exception 'Describe el motivo de la salida (ej. muestra, traspaso, corrección)';
  end if;

  select physical_stock into v_stock from public.products where id = p_product_id;
  if v_stock is null then
    raise exception 'Producto no encontrado';
  end if;
  if p_quantity > v_stock then
    raise exception 'No puedes sacar más de lo que hay en existencia física (%)', v_stock;
  end if;

  insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
  values (p_product_id, 'salida', p_quantity, p_reference, auth.uid());

  update public.products set physical_stock = physical_stock - p_quantity where id = p_product_id;
end;
$$;

notify pgrst, 'reload schema';
