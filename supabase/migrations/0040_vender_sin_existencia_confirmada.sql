-- ============================================================
-- 0040 — Vender "sin existencia en el sistema" con confirmación de almacén
-- ============================================================
-- Cuando un producto SÍ está en la sucursal pero todavía no está dado de alta
-- (o su existencia no está cargada), Ventas lo vende con la opción
-- "Sí hay, pero no está en el sistema" (con una nota de dónde está).
--
--  * La línea queda "por confirmar": Caja puede cobrar normal, pero Almacén NO
--    puede entregarla hasta que alguien de almacén confirme que sí está.
--  * Almacén confirma "Sí está" o "No está". Si no está, se manda sola a
--    "Pedidos a proveedor" y se avisa a Ventas.
--  * Al cargar el inventario (recarga) las líneas por confirmar cuyo producto
--    ya tiene existencia suficiente se confirman solas (conciliar_existencia...).
--  * Todo queda con quién lo vendió, cuándo, quién lo revisó y cuándo.
-- Requiere 0037, 0038 y 0039. Se puede correr más de una vez sin problema.

alter table public.sale_items add column if not exists existencia_estado text;
alter table public.sale_items drop constraint if exists sale_items_existencia_estado_check;
alter table public.sale_items add constraint sale_items_existencia_estado_check
  check (existencia_estado is null or existencia_estado in ('por_confirmar', 'confirmada', 'no_hay'));
alter table public.sale_items add column if not exists existencia_nota text;
alter table public.sale_items add column if not exists existencia_revisada_por uuid references auth.users (id);
alter table public.sale_items add column if not exists existencia_revisada_at timestamptz;
-- cómo se confirmó: 'almacen' (alguien lo vio) o 'inventario' (llegó en la carga del inventario)
alter table public.sale_items add column if not exists existencia_respaldo text;

create index if not exists sale_items_existencia_idx on public.sale_items (existencia_estado) where existencia_estado is not null;

-- 1) No se puede entregar una línea que sigue "por confirmar" ------------------------
create or replace function public.sale_items_bloquear_entrega_sin_confirmar()
returns trigger
language plpgsql
as $$
begin
  if new.existencia_estado = 'por_confirmar' and new.delivered_quantity > old.delivered_quantity then
    raise exception 'Este producto se vendió sin existencia en el sistema: primero Almacén debe confirmar que sí está (Pedidos a proveedor → Por confirmar existencia).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sale_items_bloquear_entrega on public.sale_items;
create trigger trg_sale_items_bloquear_entrega
  before update of delivered_quantity on public.sale_items
  for each row execute function public.sale_items_bloquear_entrega_sin_confirmar();

-- 2) Registrar la venta (igual que antes + líneas "sin existencia en el sistema") ---------
create or replace function public.register_sale(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_delivery_type delivery_type,
  p_items jsonb,
  p_scheduled_pickup_date date default null,
  p_tipo_documento text default 'nota',
  p_numero_orden text default null,
  p_metodo_pago text default null,
  p_meses_nota text default null
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
  v_doc text := lower(coalesce(nullif(trim(p_tipo_documento), ''), 'nota'));
  v_metodo text := nullif(trim(coalesce(p_metodo_pago, '')), '');
  v_sin_exist boolean;
  v_exist_nota text;
  v_hay_sin_exist boolean := false;
  v_lineas_txt text := '';
begin
  if public.current_user_role() not in ('gerencia', 'ventas') then
    raise exception 'No tienes permiso para registrar ventas';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;
  if v_doc not in ('nota', 'factura') then
    raise exception 'El documento debe ser nota o factura';
  end if;
  if v_metodo is not null and v_metodo not in ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'a_meses') then
    raise exception 'Método de pago no válido';
  end if;

  v_folio := 'V-' || nextval('public.sales_folio_seq');

  insert into public.sales (
    folio, customer_name, customer_phone, customer_address, delivery_type, status,
    created_by, scheduled_pickup_date,
    tipo_documento, numero_orden, metodo_pago, meses_nota
  )
  values (
    v_folio, p_customer_name, p_customer_phone, p_customer_address, p_delivery_type, 'pendiente',
    auth.uid(),
    case when p_delivery_type = 'retiro_sucursal' then p_scheduled_pickup_date else null end,
    v_doc,
    nullif(trim(coalesce(p_numero_orden, '')), ''),
    v_metodo,
    case when v_metodo = 'a_meses' then nullif(trim(coalesce(p_meses_nota, '')), '') else null end
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
    -- "Sí hay, pero no está en el sistema": queda por confirmar en almacén antes de entregar.
    v_sin_exist := coalesce((v_item ->> 'sin_existencia')::boolean, false);
    v_exist_nota := nullif(trim(coalesce(v_item ->> 'existencia_nota', '')), '');
    if v_sin_exist and v_exist_nota is null then
      raise exception 'Escribe una nota de dónde está el producto (no aparece en el sistema)';
    end if;
    if v_item_type = 'domicilio' and (p_customer_address is null or trim(p_customer_address) = '') then
      raise exception 'La dirección es obligatoria para entregas a domicilio';
    end if;

    select unit_price, coalesce(descuento_porcentaje, 0), precio_lista
      into v_unit_price, v_descuento, v_lista
    from public.products where id = v_product_id;

    if v_tipo_precio = 'promocion' and v_lista is not null then
      v_precio_final := round(coalesce(v_unit_price, 0), 2);
    elsif v_tipo_precio = 'promocion' then
      v_precio_final := round(coalesce(v_unit_price, 0) * (1 - coalesce(v_descuento, 0) / 100), 2);
    else
      v_precio_final := round(coalesce(v_lista, v_unit_price, 0), 2);
    end if;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, delivery_type, tipo_precio,
                                   existencia_estado, existencia_nota)
    values (v_sale_id, v_product_id, v_quantity, v_precio_final, v_item_type, v_tipo_precio,
            case when v_sin_exist then 'por_confirmar' end,
            case when v_sin_exist then v_exist_nota end)
    returning id into v_sale_item_id;

    if v_sin_exist then
      v_hay_sin_exist := true;
      v_lineas_txt := v_lineas_txt || case when v_lineas_txt = '' then '' else ', ' end
        || trim(to_char(v_quantity, 'FM999999990.##')) || ' de '
        || coalesce((select name from public.products where id = v_product_id), 'producto');
    end if;

    v_total := v_total + (v_quantity * v_precio_final);

    -- Todo queda apartado (incluida la entrega inmediata). Lo que sale de
    -- almacén se descuenta cuando se confirma la entrega/carga/retiro.
    update public.products set sold_pending = sold_pending + v_quantity where id = v_product_id;
    if v_item_type = 'domicilio' then
      v_domicilio_items := v_domicilio_items || jsonb_build_array(
        jsonb_build_object('sale_item_id', v_sale_item_id, 'product_id', v_product_id, 'quantity', v_quantity)
      );
    end if;
  end loop;

  update public.sales set total = v_total where id = v_sale_id;

  if v_hay_sin_exist then
    insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, related_sale_id, created_by)
    values (
      'confirmar_existencia',
      'Confirmar existencia — ' || v_folio,
      'Ventas vendió ' || v_lineas_txt || ' sin existencia en el sistema (venta ' || v_folio || '). Revisa si está y confírmalo antes de entregar.',
      array['almacen', 'gerencia']::app_role[],
      array['jefe', 'auxiliar'],
      '/pedidos-proveedor?tab=existencia',
      v_sale_id,
      auth.uid()
    );
  end if;

  if jsonb_array_length(v_domicilio_items) > 0 then
    insert into public.deliveries (sale_id, status, items) values (v_sale_id, 'pendiente', v_domicilio_items);
  end if;

  return v_folio;
end;
$function$;

grant execute on function public.register_sale(text, text, text, delivery_type, jsonb, date, text, text, text, text) to authenticated;

-- 3) Almacén confirma: "Sí está" / "No está" -----------------------------------------------
create or replace function public.confirmar_existencia_item(
  p_item_id uuid,
  p_hay boolean,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_folio text;
  v_pp text;
  v_pend numeric;
begin
  if not public.tiene_permiso('operar_almacen') then
    raise exception 'Solo Almacén y Gerencia confirman la existencia';
  end if;

  select si.id, si.sale_id, si.product_id, si.quantity, si.delivered_quantity, si.existencia_estado,
         s.folio as venta, s.customer_name, s.customer_phone, s.created_by as vendedor, p.name as producto
    into v
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
    left join public.products p on p.id = si.product_id
   where si.id = p_item_id;

  if v.id is null or v.existencia_estado is distinct from 'por_confirmar' then
    raise exception 'Esta línea no existe o ya fue revisada';
  end if;

  if p_hay then
    update public.sale_items
       set existencia_estado = 'confirmada', existencia_respaldo = 'almacen',
           existencia_revisada_por = auth.uid(), existencia_revisada_at = now()
     where id = p_item_id;
  else
    update public.sale_items
       set existencia_estado = 'no_hay', existencia_respaldo = 'almacen',
           existencia_revisada_por = auth.uid(), existencia_revisada_at = now()
     where id = p_item_id;

    -- Se manda a pedir al proveedor, ligado a la venta.
    v_pend := greatest(v.quantity - v.delivered_quantity, 0);
    if v_pend > 0 then
      v_pp := 'PP-' || lpad(nextval('public.pedidos_proveedor_folio_seq')::text, 6, '0');
      insert into public.pedidos_proveedor (folio, customer_name, customer_phone, product_id, descripcion, cantidad, nota, venta_folio, created_by)
      values (v_pp, v.customer_name, v.customer_phone, v.product_id, coalesce(v.producto, 'producto'), v_pend,
              'No había existencia (venta ' || v.venta || ')' || coalesce('. ' || nullif(trim(coalesce(p_nota, '')), ''), ''),
              v.venta, coalesce(v.vendedor, auth.uid()));
    end if;

    insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, related_sale_id, created_by)
    values (
      'existencia_no_hay',
      'No hay existencia — ' || v.venta,
      'Almacén revisó y NO hay ' || coalesce(v.producto, 'el producto') || ' (venta ' || v.venta || ' de ' || v.customer_name || ').'
        || case when v_pp is not null then ' Ya se mandó a pedir al proveedor (' || v_pp || '). Avísale al cliente o cambia el producto.' else '' end,
      array['ventas', 'gerencia']::app_role[],
      null,
      '/pedidos-proveedor?tab=existencia',
      v.sale_id,
      auth.uid()
    );
  end if;
end;
$$;

grant execute on function public.confirmar_existencia_item(uuid, boolean, text) to authenticated;

-- 4) Al cargar inventario: lo que ya tiene existencia suficiente se confirma solo ---------
-- (disponible = existencia - apartado >= 0; el apartado ya incluye estas ventas)
create or replace function public.conciliar_existencia_por_confirmar()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.sale_items si
     set existencia_estado = 'confirmada', existencia_respaldo = 'inventario',
         existencia_revisada_at = now()
    from public.products p
   where p.id = si.product_id
     and si.existencia_estado = 'por_confirmar'
     and p.physical_stock > 0
     and p.physical_stock - p.sold_pending >= 0;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.conciliar_existencia_por_confirmar() to authenticated;

notify pgrst, 'reload schema';
