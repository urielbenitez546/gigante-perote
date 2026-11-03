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
-- Requiere 0037/0038 solo para el resto del módulo. Se puede correr varias veces.

alter table public.products add column if not exists bajo_pedido boolean not null default false;
alter table public.products add column if not exists por_validar boolean not null default false;
alter table public.products add column if not exists creado_por uuid references auth.users (id);

create index if not exists products_bajo_pedido_idx on public.products (bajo_pedido) where bajo_pedido;

-- 1) Dar de alta -------------------------------------------------------------
create or replace function public.crear_producto_bajo_pedido(
  p_code text,
  p_name text,
  p_unit text,
  p_precio numeric,
  p_proveedor text default null
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
  v_unit product_unit;
  v_id uuid;
  v_dup text;
begin
  if public.current_user_role() not in ('gerencia', 'ventas', 'almacen') then
    raise exception 'No tienes permiso para agregar productos bajo pedido';
  end if;
  if v_code is null then raise exception 'Escribe el código del producto'; end if;
  if v_name is null then raise exception 'Escribe la descripción del producto'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'Escribe el precio (mayor a cero)'; end if;

  begin
    v_unit := coalesce(nullif(trim(coalesce(p_unit, '')), ''), 'pieza')::product_unit;
  exception when invalid_text_representation then
    raise exception 'Unidad no válida';
  end;

  select code || ' — ' || name into v_dup from public.products where lower(trim(code)) = lower(v_code) limit 1;
  if v_dup is not null then
    raise exception 'Ya existe un producto con ese código: %', v_dup;
  end if;
  select code || ' — ' || name into v_dup from public.products where lower(trim(name)) = lower(v_name) limit 1;
  if v_dup is not null then
    raise exception 'Ya existe un producto con esa descripción: %', v_dup;
  end if;

  insert into public.products (code, name, brand, category, unit, unit_price, rotacion, active, bajo_pedido, por_validar, creado_por)
  values (v_code, v_name, coalesce(v_prov, 'Bajo pedido'), 'Bajo pedido', 'pieza', round(p_precio, 2),
          'incorporacion', true, true, true, auth.uid())
  returning id into v_id;

  -- La unidad se pone después: el disparador de productos nuevos reclasifica "caja" por el nombre.
  update public.products set unit = v_unit where id = v_id;

  return v_id;
end;
$$;

grant execute on function public.crear_producto_bajo_pedido(text, text, text, numeric, text) to authenticated;

-- 2) Corregir / validar --------------------------------------------------------
create or replace function public.editar_producto_bajo_pedido(
  p_id uuid,
  p_code text,
  p_name text,
  p_unit text,
  p_precio numeric,
  p_proveedor text default null
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
  v_unit product_unit;
  v_dup text;
begin
  if public.current_user_role() not in ('gerencia', 'ventas', 'almacen') then
    raise exception 'No tienes permiso para editar productos bajo pedido';
  end if;
  if not exists (select 1 from public.products where id = p_id and bajo_pedido) then
    raise exception 'Solo se pueden editar productos bajo pedido';
  end if;
  if v_code is null then raise exception 'Escribe el código del producto'; end if;
  if v_name is null then raise exception 'Escribe la descripción del producto'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'Escribe el precio (mayor a cero)'; end if;

  begin
    v_unit := coalesce(nullif(trim(coalesce(p_unit, '')), ''), 'pieza')::product_unit;
  exception when invalid_text_representation then
    raise exception 'Unidad no válida';
  end;

  select code || ' — ' || name into v_dup from public.products where lower(trim(code)) = lower(v_code) and id <> p_id limit 1;
  if v_dup is not null then
    raise exception 'Ya existe otro producto con ese código: %', v_dup;
  end if;

  update public.products
     set code = v_code, name = v_name, unit = v_unit, unit_price = round(p_precio, 2),
         brand = coalesce(v_prov, 'Bajo pedido'), por_validar = false
   where id = p_id;
end;
$$;

grant execute on function public.editar_producto_bajo_pedido(uuid, text, text, text, numeric, text) to authenticated;

notify pgrst, 'reload schema';
