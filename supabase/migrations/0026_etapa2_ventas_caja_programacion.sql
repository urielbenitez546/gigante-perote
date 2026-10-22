-- ============================================================
-- Etapa 2: Venta -> Caja -> Almacén -> Programación de entregas
-- ============================================================
-- Flujo nuevo:
--   1) Ventas registra la venta (nota o factura, número de orden, método de pago).
--   2) La venta espera en CAJA. Almacén todavía no la ve para programar.
--   3) Caja registra lo que pagó el cliente (total o parcial) y con eso la
--      PASA a almacén. Excepción: Caja puede pasarla a almacén sin cobro
--      (el cliente pagará todo en su domicilio).
--   4) Jefe, auxiliar y Gerencia asignan día y hora aproximada.
--   5) Las entregas inmediatas avisan a almacén para cargar el material;
--      al confirmar la carga se descuenta del Kardex.
-- Es seguro correr este script más de una vez.
-- ============================================================

-- 1) Permiso nuevo: programar entregas (jefe, auxiliar y Gerencia) ----------
create or replace function public.tiene_permiso(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_nivel text;
  v_perm jsonb;
  v_def boolean;
begin
  select role::text, nivel_almacen, permisos
    into v_role, v_nivel, v_perm
  from public.profiles
  where id = auth.uid() and active;

  if v_role is null then return false; end if;
  if v_role = 'gerencia' then return true; end if;
  if v_perm ? p_key then return coalesce((v_perm ->> p_key)::boolean, false); end if;

  v_def := case p_key
    when 'editar_precios'    then v_role = 'almacen' and v_nivel = 'jefe'
    when 'operar_almacen'    then v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar')
    when 'kardex'            then v_role = 'almacen'
    when 'kardex_entradas'   then v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar')
    when 'registrar_facturas' then v_role = 'almacen' and v_nivel = 'jefe'
    when 'dar_de_baja'       then v_role = 'almacen' and v_nivel = 'jefe'
    when 'corregir_cobros'   then false
    when 'confirmar_retiros' then v_role = 'ventas' or (v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar'))
    when 'pedir_exhibicion'  then v_role = 'ventas' or (v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar'))
    when 'anular_kardex'     then v_role = 'almacen' and v_nivel = 'jefe'
    when 'ver_km'            then v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar')
    when 'programar_entregas' then v_role = 'almacen' and v_nivel in ('jefe', 'auxiliar')
    else false
  end;
  return coalesce(v_def, false);
end;
$$;

grant execute on function public.tiene_permiso(text) to authenticated;

-- 2) Columnas nuevas en "sales" ------------------------------------------------
-- Las ventas que ya existen se marcan como "ya liberadas" para que no
-- desaparezcan de almacén. Solo se hace la primera vez (cuando la columna
-- todavía no existía).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'liberada_almacen_at'
  ) then
    alter table public.sales add column liberada_almacen_at timestamptz;
    update public.sales set liberada_almacen_at = created_at;
  end if;
end $$;

alter table public.sales add column if not exists liberada_almacen_por uuid references auth.users (id);
alter table public.sales add column if not exists liberada_sin_cobro boolean not null default false;

alter table public.sales add column if not exists tipo_documento text not null default 'nota';
alter table public.sales add column if not exists numero_orden text;
alter table public.sales add column if not exists numero_factura text;
alter table public.sales add column if not exists metodo_pago text;
alter table public.sales add column if not exists meses_nota text;
alter table public.sales add column if not exists estado_pago text not null default 'pendiente';

alter table public.sales add column if not exists fecha_programada date;
alter table public.sales add column if not exists hora_programada time;
alter table public.sales add column if not exists programada_por uuid references auth.users (id);
alter table public.sales add column if not exists programada_at timestamptz;

alter table public.sales add column if not exists esperando_proveedor boolean not null default false;
alter table public.sales add column if not exists proveedor_nota text;
alter table public.sales add column if not exists proveedor_desde timestamptz;

alter table public.sales drop constraint if exists sales_tipo_documento_check;
alter table public.sales add constraint sales_tipo_documento_check check (tipo_documento in ('nota', 'factura'));
alter table public.sales drop constraint if exists sales_metodo_pago_check;
alter table public.sales add constraint sales_metodo_pago_check
  check (metodo_pago is null or metodo_pago in ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'a_meses'));
alter table public.sales drop constraint if exists sales_estado_pago_check;
alter table public.sales add constraint sales_estado_pago_check check (estado_pago in ('pendiente', 'parcial', 'pagado'));

alter table public.notifications add column if not exists related_sale_id uuid;

-- 3) El estado de pago se calcula solo a partir del total y lo cobrado ---------
create or replace function public.sales_set_estado_pago()
returns trigger
language plpgsql
as $$
begin
  new.estado_pago := case
    when coalesce(new.total, 0) > 0 and coalesce(new.amount_paid, 0) >= new.total then 'pagado'
    when coalesce(new.amount_paid, 0) > 0 then 'parcial'
    else 'pendiente'
  end;
  return new;
end;
$$;

drop trigger if exists trg_sales_estado_pago on public.sales;
create trigger trg_sales_estado_pago
  before insert or update of amount_paid, total on public.sales
  for each row execute function public.sales_set_estado_pago();

-- Recalcula el estado de las ventas que ya existían.
update public.sales set amount_paid = amount_paid;

-- 4) Historial de cambios de fecha/hora de entrega -----------------------------
create table if not exists public.sale_programacion_log (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  fecha_anterior date,
  hora_anterior time,
  fecha_nueva date,
  hora_nueva time,
  motivo text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.sale_programacion_log enable row level security;

drop policy if exists "Ver historial de programación" on public.sale_programacion_log;
create policy "Ver historial de programación"
  on public.sale_programacion_log for select
  using (public.current_user_role() in ('gerencia', 'almacen', 'reparto'));

-- 5) register_sale: ahora recibe documento, orden y método de pago.
--    Las entregas inmediatas YA NO descuentan al registrar: quedan
--    apartadas hasta que almacén confirme la carga (después de Caja).
drop function if exists public.register_sale(text, text, text, delivery_type, jsonb, date);

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

    insert into public.sale_items (sale_id, product_id, quantity, unit_price, delivery_type, tipo_precio)
    values (v_sale_id, v_product_id, v_quantity, v_precio_final, v_item_type, v_tipo_precio)
    returning id into v_sale_item_id;

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

  if jsonb_array_length(v_domicilio_items) > 0 then
    insert into public.deliveries (sale_id, status, items) values (v_sale_id, 'pendiente', v_domicilio_items);
  end if;

  return v_folio;
end;
$function$;

grant execute on function public.register_sale(text, text, text, delivery_type, jsonb, date, text, text, text, text) to authenticated;

-- 6) Caja registra el cobro y PASA la venta a almacén ---------------------------
create or replace function public.caja_cobrar_venta(
  p_sale_id uuid,
  p_amount numeric,
  p_metodo_pago text default null,
  p_numero_factura text default null,
  p_meses_nota text default null,
  p_pasar_sin_cobro boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_amount numeric := coalesce(p_amount, 0);
  v_metodo text := nullif(trim(coalesce(p_metodo_pago, '')), '');
  v_primera boolean;
  v_hay_inmediata boolean;
  v_hay_programable boolean;
  v_pagado_txt text;
begin
  if public.current_user_role() not in ('gerencia', 'caja') then
    raise exception 'Solo Caja o Gerencia pueden registrar el cobro de una venta';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_sale.status = 'cancelada' then
    raise exception 'La venta está cancelada';
  end if;
  if v_amount < 0 then
    raise exception 'El monto no puede ser negativo';
  end if;
  if v_amount > v_sale.total then
    raise exception 'El monto no puede ser mayor al total de la venta ($%)', v_sale.total;
  end if;
  if v_metodo is not null and v_metodo not in ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'a_meses') then
    raise exception 'Método de pago no válido';
  end if;

  v_primera := v_sale.liberada_almacen_at is null;

  if not v_primera and v_sale.amount_paid > 0 and not public.tiene_permiso('corregir_cobros') then
    raise exception 'El cobro ya quedó registrado. Solo Gerencia puede corregirlo';
  end if;

  if v_primera and v_amount = 0 and not coalesce(p_pasar_sin_cobro, false) then
    raise exception 'Escribe cuánto pagó el cliente, o usa "Pasar a almacén sin cobro" si pagará todo en su domicilio';
  end if;

  update public.sales
  set amount_paid = v_amount,
      payment_confirmed_by = auth.uid(),
      payment_confirmed_at = now(),
      metodo_pago = coalesce(v_metodo, metodo_pago),
      meses_nota = case
        when coalesce(v_metodo, metodo_pago) = 'a_meses'
          then coalesce(nullif(trim(coalesce(p_meses_nota, '')), ''), meses_nota)
        else null
      end,
      numero_factura = coalesce(nullif(trim(coalesce(p_numero_factura, '')), ''), numero_factura),
      liberada_almacen_at = coalesce(liberada_almacen_at, now()),
      liberada_almacen_por = case when liberada_almacen_at is null then auth.uid() else liberada_almacen_por end,
      liberada_sin_cobro = case when liberada_almacen_at is null then (v_amount = 0) else liberada_sin_cobro end
  where id = p_sale_id;

  if v_primera then
    select exists (
      select 1 from public.sale_items
      where sale_id = p_sale_id and delivered_quantity < quantity
        and coalesce(delivery_type, v_sale.delivery_type) = 'inmediata'
    ) into v_hay_inmediata;
    select exists (
      select 1 from public.sale_items
      where sale_id = p_sale_id and delivered_quantity < quantity
        and coalesce(delivery_type, v_sale.delivery_type) <> 'inmediata'
    ) into v_hay_programable;

    v_pagado_txt := case
      when v_amount = 0 then 'sin cobro en caja (paga en su domicilio)'
      when v_amount >= v_sale.total then 'pagada completa'
      else 'pago parcial: faltan $' || to_char(v_sale.total - v_amount, 'FM999,999,990.00')
    end;

    if v_hay_inmediata then
      insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, related_sale_id, created_by)
      values (
        'entrega_inmediata',
        'Entrega inmediata — ' || v_sale.folio,
        v_sale.customer_name || ' · ' || v_pagado_txt || '. Busca y carga el material, y confirma la carga para descontarlo del Kardex.',
        array['almacen', 'gerencia']::app_role[],
        null,
        '/por-programar',
        p_sale_id,
        auth.uid()
      );
    end if;

    if v_hay_programable then
      insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, related_sale_id, created_by)
      values (
        'venta_por_programar',
        'Venta por programar — ' || v_sale.folio,
        v_sale.customer_name || ' · ' || v_pagado_txt || '. Asigna día y hora de entrega.',
        array['almacen', 'gerencia']::app_role[],
        array['jefe', 'auxiliar'],
        '/por-programar',
        p_sale_id,
        auth.uid()
      );
    end if;
  end if;
end;
$$;

grant execute on function public.caja_cobrar_venta(uuid, numeric, text, text, text, boolean) to authenticated;

-- 7) Caja captura el folio de la factura después, si no lo tenía a la mano -----
create or replace function public.guardar_folio_factura(p_sale_id uuid, p_folio text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('gerencia', 'caja') then
    raise exception 'Solo Caja o Gerencia pueden capturar el folio de la factura';
  end if;
  if p_folio is null or trim(p_folio) = '' then
    raise exception 'Escribe el folio de la factura';
  end if;
  update public.sales set numero_factura = trim(p_folio) where id = p_sale_id;
  if not found then
    raise exception 'Venta no encontrada';
  end if;
end;
$$;

grant execute on function public.guardar_folio_factura(uuid, text) to authenticated;

-- 8) Programar día y hora aproximada de entrega ---------------------------------
create or replace function public.programar_entrega(
  p_sale_id uuid,
  p_fecha date,
  p_hora text default null,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_hora time;
begin
  if not public.tiene_permiso('programar_entregas') then
    raise exception 'No tienes permiso para programar entregas';
  end if;
  if p_fecha is null then
    raise exception 'Elige el día de la entrega';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_sale.liberada_almacen_at is null then
    raise exception 'Esta venta todavía está en Caja: aún no se puede programar';
  end if;

  v_hora := nullif(trim(coalesce(p_hora, '')), '')::time;

  if v_sale.fecha_programada is not null
     and (v_sale.fecha_programada is distinct from p_fecha or v_sale.hora_programada is distinct from v_hora)
     and (p_motivo is null or trim(p_motivo) = '') then
    raise exception 'Escribe el motivo del cambio de fecha u hora';
  end if;

  insert into public.sale_programacion_log
    (sale_id, fecha_anterior, hora_anterior, fecha_nueva, hora_nueva, motivo)
  values
    (p_sale_id, v_sale.fecha_programada, v_sale.hora_programada, p_fecha, v_hora, nullif(trim(coalesce(p_motivo, '')), ''));

  update public.sales
  set fecha_programada = p_fecha,
      hora_programada = v_hora,
      programada_por = auth.uid(),
      programada_at = now()
  where id = p_sale_id;
end;
$$;

grant execute on function public.programar_entrega(uuid, date, text, text) to authenticated;

-- 9) Esperando proveedor (material pedido que aún no llega) -------------------
create or replace function public.marcar_esperando_proveedor(
  p_sale_id uuid,
  p_activo boolean,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tiene_permiso('programar_entregas') then
    raise exception 'No tienes permiso para cambiar este estado';
  end if;

  update public.sales
  set esperando_proveedor = coalesce(p_activo, false),
      proveedor_nota = case when coalesce(p_activo, false) then nullif(trim(coalesce(p_nota, '')), '') else null end,
      proveedor_desde = case when coalesce(p_activo, false) then now() else null end
  where id = p_sale_id and liberada_almacen_at is not null;

  if not found then
    raise exception 'Venta no encontrada o todavía en Caja';
  end if;
end;
$$;

grant execute on function public.marcar_esperando_proveedor(uuid, boolean, text) to authenticated;

-- 10) Confirmar la carga de una entrega inmediata: descuenta del Kardex --------
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
  if not public.tiene_permiso('confirmar_retiros') then
    raise exception 'No tienes permiso para confirmar entregas';
  end if;

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

-- ============================================================
-- Fin de la migración de la Etapa 2
-- ============================================================
