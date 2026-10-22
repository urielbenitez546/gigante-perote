-- ============================================================
-- 1) Precio Público / Precio Promoción en el punto de venta
-- ============================================================
-- Hasta ahora register_sale aplicaba el % de descuento_porcentaje del
-- producto SIEMPRE, sin que Ventas pudiera elegir. Ahora cada renglón
-- de venta trae "tipo_precio": 'publico' (precio normal, sin tocar el
-- descuento) o 'promocion' (aplica el descuento_porcentaje del producto,
-- igual que antes). Por default es 'publico', para que por ahora la
-- página solo cobre el precio normal salvo que alguien elija Promoción
-- a propósito.

alter table public.sale_items
  add column if not exists tipo_precio text not null default 'publico'
  check (tipo_precio in ('publico', 'promocion'));

-- Marca de que un lote ya se revirtió (para no mostrar el botón dos veces).
alter table public.label_batches
  add column if not exists revertido_at timestamptz,
  add column if not exists revertido_por uuid references auth.users(id);

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
set search_path to 'public'
as $function$
declare
  v_sale_id uuid;
  v_folio text;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_descuento numeric;
  v_tipo_precio text;
  v_precio_final numeric;
  v_item_type delivery_type;
  v_sale_item_id uuid;
  v_domicilio_items jsonb := '[]'::jsonb;
begin
  if public.current_user_role() not in ('gerencia', 'ventas') then
    raise exception 'No tienes permiso para registrar ventas';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  v_folio := 'V-' || nextval('public.sales_folio_seq');

  insert into public.sales (
    folio, customer_name, customer_phone, customer_address, delivery_type, status,
    created_by, scheduled_pickup_date
  )
  values (
    v_folio, p_customer_name, p_customer_phone, p_customer_address, p_delivery_type, 'pendiente',
    auth.uid(),
    case when p_delivery_type = 'retiro_sucursal' then p_scheduled_pickup_date else null end
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_item_type := coalesce((v_item ->> 'delivery_type')::delivery_type, p_delivery_type);
    v_tipo_precio := case when lower(coalesce(v_item ->> 'tipo_precio', 'publico')) = 'promocion'
                          then 'promocion' else 'publico' end;

    if v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero';
    end if;
    if v_item_type = 'domicilio' and (p_customer_address is null or trim(p_customer_address) = '') then
      raise exception 'La dirección es obligatoria para entregas a domicilio';
    end if;

    select unit_price, coalesce(descuento_porcentaje, 0) into v_unit_price, v_descuento
    from public.products where id = v_product_id;

    if v_tipo_precio = 'promocion' then
      v_precio_final := round(coalesce(v_unit_price, 0) * (1 - coalesce(v_descuento, 0) / 100), 2);
    else
      v_precio_final := round(coalesce(v_unit_price, 0), 2);
    end if;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, delivery_type, tipo_precio)
    values (v_sale_id, v_product_id, v_quantity, v_precio_final, v_item_type, v_tipo_precio)
    returning id into v_sale_item_id;

    v_total := v_total + (v_quantity * v_precio_final);

    if v_item_type = 'inmediata' then
      update public.products set physical_stock = physical_stock - v_quantity where id = v_product_id;
      insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
      values (v_product_id, 'salida', v_quantity, v_folio, auth.uid());
      update public.sale_items set delivered_quantity = v_quantity where id = v_sale_item_id;
    else
      update public.products set sold_pending = sold_pending + v_quantity where id = v_product_id;
      if v_item_type = 'domicilio' then
        v_domicilio_items := v_domicilio_items || jsonb_build_array(
          jsonb_build_object('sale_item_id', v_sale_item_id, 'product_id', v_product_id, 'quantity', v_quantity)
        );
      end if;
    end if;
  end loop;

  update public.sales set total = v_total where id = v_sale_id;

  update public.sales
  set status = case
        when not exists (select 1 from public.sale_items where sale_id = v_sale_id and delivered_quantity < quantity) then 'entregada'::sale_status
        when exists (select 1 from public.sale_items where sale_id = v_sale_id and delivered_quantity > 0) then 'parcial'::sale_status
        else 'pendiente'::sale_status
      end,
      delivered_at = case
        when not exists (select 1 from public.sale_items where sale_id = v_sale_id and delivered_quantity < quantity) then now()
        else null
      end
  where id = v_sale_id;

  if jsonb_array_length(v_domicilio_items) > 0 then
    insert into public.deliveries (sale_id, status, items) values (v_sale_id, 'pendiente', v_domicilio_items);
  end if;

  return v_folio;
end;
$function$;

-- ============================================================
-- 2) Revertir un lote de Excel/reglas de precios y etiquetas
-- ============================================================
-- Cuando termina la temporada de una promoción (el Excel de Veracruz),
-- Gerencia puede revertir ese lote: regresa precio, rotación y
-- descuento al valor que tenían ANTES de ese lote, pero solo en los
-- productos que no hayan sido modificados otra vez después (para no
-- pisar un cambio más reciente y legítimo). El trigger encolar_etiqueta
-- ya existente se encarga de crear las etiquetas nuevas para avisar
-- que hay que imprimir de nuevo con el precio restaurado.
create or replace function public.revertir_lote_etiquetas(p_lote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_q record;
  v_revertidos integer := 0;
  v_omitidos integer := 0;
  v_nombre text;
begin
  if public.current_user_role() is distinct from 'gerencia' then
    raise exception 'Solo Gerencia puede revertir un lote';
  end if;

  select nombre into v_nombre from public.label_batches where id = p_lote_id;
  if v_nombre is null then
    raise exception 'Ese lote no existe';
  end if;
  if exists (select 1 from public.label_batches where id = p_lote_id and revertido_at is not null) then
    raise exception 'Ese lote ya se había revertido antes';
  end if;

  for v_q in
    select lq.*, p.unit_price as precio_actual, p.descuento_porcentaje as descuento_actual,
           p.rotacion::text as rotacion_actual
    from public.label_queue lq
    join public.products p on p.id = lq.product_id
    where lq.batch_id = p_lote_id
  loop
    if v_q.precio_actual is not distinct from v_q.precio_despues
       and v_q.descuento_actual is not distinct from v_q.descuento_despues
       and v_q.rotacion_actual is not distinct from v_q.rotacion_despues then
      update public.products
      set unit_price = v_q.precio_antes,
          descuento_porcentaje = v_q.descuento_antes,
          rotacion = v_q.rotacion_antes::product_rotacion
      where id = v_q.product_id;
      v_revertidos := v_revertidos + 1;
    else
      -- Ya lo volvieron a cambiar después de este lote: no lo tocamos.
      v_omitidos := v_omitidos + 1;
    end if;
  end loop;

  update public.label_batches
  set revertido_at = now(), revertido_por = auth.uid()
  where id = p_lote_id;

  return jsonb_build_object('revertidos', v_revertidos, 'omitidos', v_omitidos, 'nombre', v_nombre);
end;
$function$;
