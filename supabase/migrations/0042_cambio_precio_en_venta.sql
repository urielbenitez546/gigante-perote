-- ============================================================
-- 0042 — Cambio de precio en la línea de venta (con motivo y observación)
-- ============================================================
-- Igual que en SIGAM ("Petición de cambio de precio"): el vendedor, en una
-- línea de la venta, puede poner otro precio. Es obligatorio elegir el MOTIVO
-- y escribir una OBSERVACIÓN. No requiere aprobación: queda registrado en la
-- línea (precio original, motivo, observación) y a Gerencia le llega un aviso.
-- No cambia el precio del producto en el catálogo, solo el de esa venta.
-- Requiere 0040. Se puede correr más de una vez sin problema.

alter table public.sale_items add column if not exists precio_original numeric;
alter table public.sale_items add column if not exists motivo_precio text;
alter table public.sale_items add column if not exists observacion_precio text;

create index if not exists sale_items_precio_cambiado_idx
  on public.sale_items (motivo_precio) where motivo_precio is not null;

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
  v_precio_nuevo numeric;
  v_motivo text;
  v_obs text;
  v_precio_orig numeric;
  v_hay_precio boolean := false;
  v_precios_txt text := '';
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

    -- Cambio de precio pedido por el vendedor: motivo y observación obligatorios.
    v_precio_nuevo := nullif(trim(coalesce(v_item ->> 'precio_nuevo', '')), '')::numeric;
    v_motivo := nullif(trim(coalesce(v_item ->> 'motivo_precio', '')), '');
    v_obs := nullif(trim(coalesce(v_item ->> 'observacion_precio', '')), '');
    v_precio_orig := null;
    if v_precio_nuevo is not null then
      if v_precio_nuevo < 0 then
        raise exception 'El precio nuevo no puede ser negativo';
      end if;
      if v_motivo is null then
        raise exception 'Elige el motivo del cambio de precio';
      end if;
      if v_obs is null then
        raise exception 'Escribe una observación que explique el cambio de precio';
      end if;
      if round(v_precio_nuevo, 2) = v_precio_final then
        raise exception 'El precio nuevo es igual al precio actual; quita el cambio de precio';
      end if;
      v_precio_orig := v_precio_final;
      v_precio_final := round(v_precio_nuevo, 2);
      v_hay_precio := true;
      v_precios_txt := v_precios_txt || case when v_precios_txt = '' then '' else '; ' end
        || coalesce((select name from public.products where id = v_product_id), 'producto')
        || ' de $' || trim(to_char(v_precio_orig, 'FM999,999,990.00'))
        || ' a $' || trim(to_char(v_precio_final, 'FM999,999,990.00'))
        || ' (' || v_motivo || ')';
    end if;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, delivery_type, tipo_precio,
                                   existencia_estado, existencia_nota,
                                   precio_original, motivo_precio, observacion_precio)
    values (v_sale_id, v_product_id, v_quantity, v_precio_final, v_item_type, v_tipo_precio,
            case when v_sin_exist then 'por_confirmar' end,
            case when v_sin_exist then v_exist_nota end,
            v_precio_orig,
            case when v_precio_orig is not null then v_motivo end,
            case when v_precio_orig is not null then v_obs end)
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

  if v_hay_precio then
    insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, related_sale_id, created_by)
    values (
      'precio_modificado',
      'Precio modificado — ' || v_folio,
      coalesce((select full_name from public.profiles where id = auth.uid()), 'Ventas')
        || ' cambió el precio en la venta ' || v_folio || ': ' || v_precios_txt || '.',
      array['gerencia']::app_role[],
      null,
      '/ventas',
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

notify pgrst, 'reload schema';
