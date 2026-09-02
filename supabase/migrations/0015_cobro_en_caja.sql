-- ============================================================
-- ETAPA EXTRA — Cobro en caja al momento de la venta
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001 a 0014 antes)
--
-- NOTA TÉCNICA: este script es SEGURO de correr más de una vez.
--
-- QUÉ RESUELVE:
-- Retoma el proceso real de cobro que confirmaste: cuando Ventas
-- registra una venta, a Caja le debe llegar el aviso de inmediato
-- (ya lo hacía, ahora además con una notificación), y Caja debe
-- poder anotar cuánto le pagó el cliente ahí mismo en el mostrador
-- — que puede ser el total completo, o solo una parte si el resto
-- se va a cobrar después en la entrega a domicilio (eso ya se lleva
-- por separado en "Evidencias y Cobros", con lo que cobra el chofer).
--
-- Ejemplo: una venta de $12,000 — el cliente deja pagados $9,000 en
-- caja, y quedan $3,000 pendientes de cobro cuando el chofer entregue
-- a domicilio.
-- ============================================================

-- 1) Columnas nuevas en "sales" para lo que se cobró en el mostrador.
alter table public.sales add column if not exists amount_paid numeric not null default 0;
alter table public.sales add column if not exists payment_confirmed_by uuid references auth.users (id);
alter table public.sales add column if not exists payment_confirmed_at timestamptz;

-- 2) Función para que Caja (o Gerencia) registre cuánto pagó el
--    cliente en el mostrador. Se puede corregir/actualizar mientras
--    no exceda el total de la venta.
create or replace function public.register_sale_payment(
  p_sale_id uuid,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
begin
  if public.current_user_role() not in ('gerencia', 'caja') then
    raise exception 'No tienes permiso para registrar cobros de ventas';
  end if;

  select * into v_sale from public.sales where id = p_sale_id;
  if v_sale is null then
    raise exception 'Venta no encontrada';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'El monto no puede ser negativo';
  end if;
  if p_amount > v_sale.total then
    raise exception 'El monto no puede ser mayor al total de la venta ($%)', v_sale.total;
  end if;

  update public.sales
  set amount_paid = p_amount,
      payment_confirmed_by = auth.uid(),
      payment_confirmed_at = now()
  where id = p_sale_id;
end;
$$;

grant execute on function public.register_sale_payment(uuid, numeric) to authenticated;

-- 3) register_sale: igual que en 0006b, pero ahora avisa a Caja y
--    Gerencia con una notificación en cuanto se registra la venta.
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

    if v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero';
    end if;
    if v_item_type = 'domicilio' and (p_customer_address is null or trim(p_customer_address) = '') then
      raise exception 'La dirección es obligatoria para entregas a domicilio';
    end if;

    select unit_price into v_unit_price from public.products where id = v_product_id;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, delivery_type)
    values (v_sale_id, v_product_id, v_quantity, coalesce(v_unit_price, 0), v_item_type)
    returning id into v_sale_item_id;

    v_total := v_total + (v_quantity * coalesce(v_unit_price, 0));

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

  insert into public.notifications (type, title, message, target_roles, link_path, created_by)
  values (
    'venta_nueva',
    'Nueva venta — ' || v_folio,
    p_customer_name || ': $' || to_char(v_total, 'FM999,999,990.00') || ' (' || p_delivery_type || ')',
    array['caja', 'gerencia']::app_role[],
    '/ventas',
    auth.uid()
  );

  return v_folio;
end;
$$;

grant execute on function public.register_sale(text, text, text, delivery_type, jsonb, date) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la migración de cobro en caja
-- ============================================================
