-- ============================================================
-- Lista de precios público (Helvex, Proyecta...)
-- ============================================================
-- Para algunas marcas el precio que llega de SIGAM (unit_price) es en
-- realidad el precio de PROMOCIÓN, y el precio PÚBLICO viene de una lista
-- aparte (Excel de la marca) que Gerencia sube y va actualizando.
--   * precio_lista: precio público con IVA de esa lista (null = no aplica).
--   * Público  -> cobra precio_lista si existe; si no, unit_price (igual que antes).
--   * Promoción -> con lista: unit_price tal cual (sin descuento extra);
--                  sin lista: unit_price menos el descuento (igual que antes).
-- Subir el Excel de SIGAM NO toca precio_lista, y quitar la lista regresa
-- el producto a cobrar unit_price como público.

alter table public.products
  add column if not exists precio_lista numeric(12,2),
  add column if not exists precio_lista_fuente text,
  add column if not exists precio_lista_at timestamptz;

create or replace function public.aplicar_lista_precios(p_fuente text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item jsonb;
  v_n integer := 0;
  v_filas integer;
begin
  if public.current_user_role() is distinct from 'gerencia' then
    raise exception 'Solo Gerencia puede subir la lista de precios';
  end if;
  if coalesce(trim(p_fuente), '') = '' then
    raise exception 'Falta el nombre de la lista';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item ->> 'precio')::numeric <= 0 then
      continue;
    end if;
    update public.products
       set precio_lista = round((v_item ->> 'precio')::numeric, 2),
           precio_lista_fuente = trim(p_fuente),
           precio_lista_at = now()
     where id = (v_item ->> 'product_id')::uuid;
    get diagnostics v_filas = row_count;
    v_n := v_n + v_filas;
  end loop;
  return v_n;
end;
$function$;

create or replace function public.quitar_lista_precios(p_fuente text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  if public.current_user_role() is distinct from 'gerencia' then
    raise exception 'Solo Gerencia puede quitar una lista de precios';
  end if;
  update public.products
     set precio_lista = null, precio_lista_fuente = null, precio_lista_at = null
   where precio_lista_fuente = p_fuente;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

-- register_sale: Público cobra precio_lista si el producto la tiene.
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
  v_lista numeric;
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

    select unit_price, coalesce(descuento_porcentaje, 0), precio_lista
      into v_unit_price, v_descuento, v_lista
    from public.products where id = v_product_id;

    if v_tipo_precio = 'promocion' and v_lista is not null then
      -- Con lista de precios, la promoción es el precio de SIGAM tal cual.
      v_precio_final := round(coalesce(v_unit_price, 0), 2);
    elsif v_tipo_precio = 'promocion' then
      v_precio_final := round(coalesce(v_unit_price, 0) * (1 - coalesce(v_descuento, 0) / 100), 2);
    else
      v_precio_final := round(coalesce(v_lista, v_unit_price, 0), 2);
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
