-- ============================================================
-- 0039 — Productos "bajo pedido" (de catálogo, sin existencia en SIGAM)
-- ============================================================
-- Hay productos de catálogo que la sucursal no tiene en su inventario. Ventas,
-- Almacén y Gerencia pueden darlos de alta (código, descripción, unidad y
-- precio) para poder venderlos y pedirlos al proveedor con el flujo normal.
--
-- * Quedan marcados bajo_pedido = true y por_validar = true: no salen en
--   Inventario, Kardex, alertas ni etiquetas (la página los separa).
-- * El ID de SIGAM queda vacío (external_id null): la recarga de inventario
--   no los toca.
-- * Cualquiera de los tres roles puede corregirlos y marcarlos como revisados.
-- El ID de SIGAM es opcional (solo si el producto ya lo tiene). Ojo: un producto con ID que
-- no viene en el Excel de SIGAM se pone en 0 en la recarga de inventario.
-- Se puede correr varias veces (también si ya se corrió una versión anterior).

alter table public.products add column if not exists bajo_pedido boolean not null default false;
alter table public.products add column if not exists por_validar boolean not null default false;
alter table public.products add column if not exists creado_por uuid references auth.users (id);

-- Si no se captura código, se genera uno (BP-000001, BP-000002...).
create sequence if not exists public.productos_bajo_pedido_seq;

create index if not exists products_bajo_pedido_idx on public.products (bajo_pedido) where bajo_pedido;

-- 1) Dar de alta -------------------------------------------------------------
drop function if exists public.crear_producto_bajo_pedido(text, text, text, numeric, text);
drop function if exists public.editar_producto_bajo_pedido(uuid, text, text, text, numeric, text);

create or replace function public.crear_producto_bajo_pedido(
  p_code text,
  p_name text,
  p_unit text,
  p_precio numeric,
  p_proveedor text default null,
  p_external_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(trim(coalesce(p_code, '')), '');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_prov text := nullif(trim(coalesce(p_proveedor, '')), '');
  v_ext text := nullif(trim(coalesce(p_external_id, '')), '');
  v_unit product_unit;
  v_id uuid;
  v_dup text;
begin
  if public.current_user_role() not in ('gerencia', 'ventas', 'almacen') then
    raise exception 'No tienes permiso para agregar productos bajo pedido';
  end if;
  if v_name is null then raise exception 'Escribe la descripción del producto'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'Escribe el precio (mayor a cero)'; end if;

  begin
    v_unit := coalesce(nullif(trim(coalesce(p_unit, '')), ''), 'pieza')::product_unit;
  exception when invalid_text_representation then
    raise exception 'Unidad no válida';
  end;

  if v_code is null then
    -- Sin código: se genera uno que no choque con los existentes.
    loop
      v_code := 'BP-' || lpad(nextval('public.productos_bajo_pedido_seq')::text, 6, '0');
      exit when not exists (select 1 from public.products where lower(trim(code)) = lower(v_code));
    end loop;
  else
    select code || ' — ' || name into v_dup from public.products where lower(trim(code)) = lower(v_code) limit 1;
    if v_dup is not null then
      raise exception 'Ya existe un producto con ese código: %', v_dup;
    end if;
  end if;
  select code || ' — ' || name into v_dup from public.products where lower(trim(name)) = lower(v_name) limit 1;
  if v_dup is not null then
    raise exception 'Ya existe un producto con esa descripción: %', v_dup;
  end if;

  if v_ext is not null then
    select code || ' — ' || name into v_dup from public.products where external_id::text = v_ext limit 1;
    if v_dup is not null then
      raise exception 'Ya existe un producto con ese ID: %', v_dup;
    end if;
  end if;

  insert into public.products (code, name, brand, category, unit, unit_price, rotacion, active, bajo_pedido, por_validar, creado_por)
  values (v_code, v_name, coalesce(v_prov, 'Bajo pedido'), 'Bajo pedido', 'pieza', round(p_precio, 2),
          'incorporacion', true, true, true, auth.uid())
  returning id into v_id;

  -- La unidad se pone después: el disparador de productos nuevos reclasifica "caja" por el nombre.
  update public.products set unit = v_unit where id = v_id;
  if v_ext is not null then
    begin
      execute format('update public.products set external_id = %L where id = %L', v_ext, v_id);
    exception when others then
      raise exception 'El ID no es válido (%): %', v_ext, sqlerrm;
    end;
  end if;

  return v_id;
end;
$$;

grant execute on function public.crear_producto_bajo_pedido(text, text, text, numeric, text, text) to authenticated;

-- 2) Corregir / validar --------------------------------------------------------
create or replace function public.editar_producto_bajo_pedido(
  p_id uuid,
  p_code text,
  p_name text,
  p_unit text,
  p_precio numeric,
  p_proveedor text default null,
  p_external_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(trim(coalesce(p_code, '')), '');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_prov text := nullif(trim(coalesce(p_proveedor, '')), '');
  v_ext text := nullif(trim(coalesce(p_external_id, '')), '');
  v_unit product_unit;
  v_dup text;
begin
  if public.current_user_role() not in ('gerencia', 'ventas', 'almacen') then
    raise exception 'No tienes permiso para editar productos bajo pedido';
  end if;
  if not exists (select 1 from public.products where id = p_id and bajo_pedido) then
    raise exception 'Solo se pueden editar productos bajo pedido';
  end if;
  if v_name is null then raise exception 'Escribe la descripción del producto'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'Escribe el precio (mayor a cero)'; end if;

  begin
    v_unit := coalesce(nullif(trim(coalesce(p_unit, '')), ''), 'pieza')::product_unit;
  exception when invalid_text_representation then
    raise exception 'Unidad no válida';
  end;

  -- Código en blanco: se conserva el que ya tenía.
  if v_code is null then
    select code into v_code from public.products where id = p_id;
  else
    select code || ' — ' || name into v_dup from public.products where lower(trim(code)) = lower(v_code) and id <> p_id limit 1;
    if v_dup is not null then
      raise exception 'Ya existe otro producto con ese código: %', v_dup;
    end if;
  end if;

  if v_ext is not null then
    select code || ' — ' || name into v_dup from public.products where external_id::text = v_ext and id <> p_id limit 1;
    if v_dup is not null then
      raise exception 'Ya existe otro producto con ese ID: %', v_dup;
    end if;
  end if;

  update public.products
     set code = v_code, name = v_name, unit = v_unit, unit_price = round(p_precio, 2),
         brand = coalesce(v_prov, 'Bajo pedido'), por_validar = false
   where id = p_id;
  begin
    execute format('update public.products set external_id = %L where id = %L', v_ext, p_id);
  exception when others then
    raise exception 'El ID no es válido (%): %', v_ext, sqlerrm;
  end;
end;
$$;

grant execute on function public.editar_producto_bajo_pedido(uuid, text, text, text, numeric, text, text) to authenticated;

-- 3) Pasar a inventario normal (cuando el producto ya está dado de alta en el inventario) ------
create or replace function public.pasar_bajo_pedido_a_inventario(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('gerencia', 'almacen') then
    raise exception 'Solo Almacén y Gerencia pasan un producto al inventario normal';
  end if;
  update public.products set bajo_pedido = false, por_validar = false where id = p_id and bajo_pedido;
  if not found then
    raise exception 'El producto no existe o ya es un producto normal';
  end if;
end;
$$;

grant execute on function public.pasar_bajo_pedido_a_inventario(uuid) to authenticated;

notify pgrst, 'reload schema';
