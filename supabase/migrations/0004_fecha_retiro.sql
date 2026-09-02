-- ============================================================
-- ETAPA 4b — Fecha estimada de recolección (retiro en sucursal)
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001, 0002 y 0003 antes)
--
-- Agrega un campo opcional para anotar cuándo se espera que el
-- cliente pase a recoger su pedido, cuando el tipo de entrega es
-- "retiro_sucursal".
-- ============================================================

alter table public.sales add column scheduled_pickup_date date;

-- Se reemplaza register_sale para aceptar la fecha estimada
-- (parámetro nuevo con valor por defecto, al final, para no romper
-- nada de lo que ya funciona).
create or replace function public.register_sale(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_delivery_type delivery_type,
  p_items jsonb,
  p_scheduled_pickup_date date default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_folio text;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_status sale_status;
begin
  if public.current_user_role() not in ('gerencia', 'ventas') then
    raise exception 'No tienes permiso para registrar ventas';
  end if;

  if p_delivery_type = 'domicilio' and (p_customer_address is null or trim(p_customer_address) = '') then
    raise exception 'La dirección es obligatoria para entregas a domicilio';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  v_folio := 'V-' || nextval('public.sales_folio_seq');
  v_status := case when p_delivery_type = 'inmediata' then 'entregada' else 'pendiente' end;

  insert into public.sales (
    folio, customer_name, customer_phone, customer_address, delivery_type, status,
    created_by, delivered_at, scheduled_pickup_date
  )
  values (
    v_folio, p_customer_name, p_customer_phone, p_customer_address, p_delivery_type, v_status,
    auth.uid(),
    case when p_delivery_type = 'inmediata' then now() else null end,
    case when p_delivery_type = 'retiro_sucursal' then p_scheduled_pickup_date else null end
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;

    if v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero';
    end if;

    select unit_price into v_unit_price from public.products where id = v_product_id;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (v_sale_id, v_product_id, v_quantity, coalesce(v_unit_price, 0));

    v_total := v_total + (v_quantity * coalesce(v_unit_price, 0));

    if p_delivery_type = 'inmediata' then
      update public.products set physical_stock = physical_stock - v_quantity where id = v_product_id;
      insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
      values (v_product_id, 'salida', v_quantity, v_folio, auth.uid());
    else
      update public.products set sold_pending = sold_pending + v_quantity where id = v_product_id;
    end if;
  end loop;

  update public.sales set total = v_total where id = v_sale_id;

  return v_folio;
end;
$$;

grant execute on function public.register_sale(text, text, text, delivery_type, jsonb, date) to authenticated;

-- ============================================================
-- Fin de la migración de la Etapa 4b
-- ============================================================
