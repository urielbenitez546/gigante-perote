-- ============================================================
-- 0041 — Crear un producto nuevo desde Inventario (Almacén / Gerencia)
-- ============================================================
-- El jefe o auxiliar de almacén (o Gerencia) da de alta un producto que no
-- existe en el sistema, con su existencia inicial. Si tiene ID de SIGAM, la
-- próxima recarga de inventario lo reconoce por ese ID (no lo duplica).
-- La existencia inicial queda en el Kardex como una entrada ("Alta de producto").
-- Se puede correr más de una vez sin problema.

create sequence if not exists public.productos_nuevos_seq;

create or replace function public.crear_producto_inventario(
  p_external_id text,
  p_code text,
  p_name text,
  p_brand text,
  p_unit text,
  p_precio numeric,
  p_existencia numeric default 0,
  p_categoria text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ext text := nullif(trim(coalesce(p_external_id, '')), '');
  v_code text := nullif(trim(coalesce(p_code, '')), '');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_brand text := coalesce(nullif(trim(coalesce(p_brand, '')), ''), 'Sin marca');
  v_cat text := nullif(trim(coalesce(p_categoria, '')), '');
  v_exist numeric := coalesce(p_existencia, 0);
  v_unit product_unit;
  v_id uuid;
  v_dup text;
begin
  if not public.tiene_permiso('operar_almacen') then
    raise exception 'Solo Almacén y Gerencia pueden crear productos';
  end if;
  if v_name is null then raise exception 'Escribe la descripción del producto'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'Escribe el precio público (mayor a cero)'; end if;
  if v_exist < 0 then raise exception 'La existencia inicial no puede ser negativa'; end if;

  begin
    v_unit := coalesce(nullif(trim(coalesce(p_unit, '')), ''), 'pieza')::product_unit;
  exception when invalid_text_representation then
    raise exception 'Unidad no válida';
  end;

  if v_ext is not null then
    select code || ' — ' || name into v_dup from public.products where external_id::text = v_ext limit 1;
    if v_dup is not null then
      raise exception 'Ya existe un producto con ese ID: %. Si es un producto "bajo pedido", pásalo a inventario desde Pedidos a proveedor.', v_dup;
    end if;
  end if;

  if v_code is null then
    v_code := case when v_ext is not null then 'SIGAM-' || v_ext
                   else 'NP-' || lpad(nextval('public.productos_nuevos_seq')::text, 6, '0') end;
  end if;
  select code || ' — ' || name into v_dup from public.products where lower(trim(code)) = lower(v_code) limit 1;
  if v_dup is not null then
    raise exception 'Ya existe un producto con ese código: %', v_dup;
  end if;
  select code || ' — ' || name into v_dup from public.products where lower(trim(name)) = lower(v_name) limit 1;
  if v_dup is not null then
    raise exception 'Ya existe un producto con esa descripción: %', v_dup;
  end if;

  -- Categoría: la que se escriba, o la más común de esa marca, o "Sin categoría".
  if v_cat is null then
    select category into v_cat from public.products where brand = v_brand
     group by category order by count(*) desc limit 1;
    v_cat := coalesce(v_cat, 'Sin categoría');
  end if;

  insert into public.products (code, name, brand, category, unit, unit_price, physical_stock, sold_pending, rotacion, active, last_counted_at)
  values (v_code, v_name, v_brand, v_cat, 'pieza', round(p_precio, 2), v_exist, 0, 'incorporacion', true,
          case when v_exist > 0 then now() end)
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

  if v_exist > 0 then
    insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
    values (v_id, 'entrada', v_exist, 'Alta de producto (existencia inicial)', auth.uid());
  end if;

  return v_id;
end;
$$;

grant execute on function public.crear_producto_inventario(text, text, text, text, text, numeric, numeric, text) to authenticated;

notify pgrst, 'reload schema';
