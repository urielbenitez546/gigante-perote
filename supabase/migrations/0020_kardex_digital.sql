-- ============================================================
-- Kardex digital (QR en etiqueta amarilla -> ficha del producto)
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- ============================================================
-- Qué agrega:
--   1) register_inventory_salida: para registrar una salida MANUAL de
--      almacén que no es ni venta, ni merma, ni exhibición (ej. una
--      muestra que se lleva un vendedor, un traspaso a otra sucursal,
--      una corrección). Las entradas ya existían (register_inventory_entry);
--      esto completa el par entrada/salida que pedían para el Kardex.
--      Las salidas por venta, por merma y por exhibición YA se registran
--      solas (no se tocan aquí) para no duplicar el descuento de stock.
--
-- No se crean tablas nuevas: el Kardex usa lo que ya existe
-- (inventory_movements = bitácora de entradas/salidas/ajustes/merma/
-- exhibición, e inventory_counts = conteos físicos). Lo nuevo es la
-- función de abajo y la pantalla del Kardex en el frontend, que arma
-- ambas tablas en una sola línea de tiempo por producto.
-- ============================================================

create function public.register_inventory_salida(
  p_product_id uuid,
  p_quantity numeric,
  p_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
begin
  if public.current_user_role() not in ('gerencia', 'almacen') then
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

  update public.products
  set physical_stock = physical_stock - p_quantity
  where id = p_product_id;
end;
$$;

grant execute on function public.register_inventory_salida(uuid, numeric, text) to authenticated;

-- ============================================================
-- Fin de la migración del Kardex digital
-- ============================================================
