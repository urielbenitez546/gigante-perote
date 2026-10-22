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
