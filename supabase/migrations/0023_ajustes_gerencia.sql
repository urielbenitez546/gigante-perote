-- ============================================================
-- Ajustes pedidos por Gerencia (octubre)
-- ============================================================
-- Ejecuta en: Supabase > SQL Editor > New query (después de 0022).
--  1) Permisos nuevos: Kardex entradas/conteos, registrar facturas,
--     dar de baja y corregir cobros.
--  2) Almacenista: solo salidas en el Kardex (sin entradas).
--  3) Auxiliar: sin facturas y sin dar de baja; en su lugar REPORTA
--     el incidente, que le llega solo al Jefe de almacén y a Gerencia.
--  4) Caja registra el cobro una vez; corregirlo es de Gerencia.
-- ============================================================

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
    else false
  end;
  return coalesce(v_def, false);
end;
$$;

grant execute on function public.tiene_permiso(text) to authenticated;

-- Facturas de compra: solo quien tenga el permiso.
create or replace function public.register_purchase_invoice(
  p_invoice_number text,
  p_supplier text,
  p_photo_path text,
  p_items jsonb -- [{"product_id":"...","quantity":10}, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
begin
  if not public.tiene_permiso('registrar_facturas') then
    raise exception 'No tienes permiso para registrar facturas';
  end if;

  if p_invoice_number is null or trim(p_invoice_number) = '' then
    raise exception 'El número de factura es obligatorio';
  end if;
  if p_supplier is null or trim(p_supplier) = '' then
    raise exception 'El proveedor es obligatorio';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'La factura debe tener al menos un producto';
  end if;

  insert into public.purchase_invoices (invoice_number, supplier, photo_path, created_by)
  values (p_invoice_number, p_supplier, p_photo_path, auth.uid())
  returning id into v_invoice_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;

    if v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero';
    end if;

    insert into public.purchase_invoice_items (invoice_id, product_id, quantity)
    values (v_invoice_id, v_product_id, v_quantity);

    update public.products set physical_stock = physical_stock + v_quantity where id = v_product_id;

    insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
    values (v_product_id, 'entrada', v_quantity, 'Factura ' || p_invoice_number, auth.uid());
  end loop;

  return v_invoice_id;
end;
$$;

-- Cobro en caja: Caja lo registra una vez; corregirlo solo con permiso.
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
  if coalesce(v_sale.amount_paid, 0) > 0 and not public.tiene_permiso('corregir_cobros') then
    raise exception 'El cobro ya fue registrado. Solo Gerencia puede corregir el monto cobrado';
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

-- Dar de baja material: solo con permiso (Jefe de almacén y Gerencia).
create or replace function public.register_write_off(
  p_product_id uuid, p_quantity numeric, p_reason text, p_photo_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
begin
  if not public.tiene_permiso('dar_de_baja') then
    raise exception 'No tienes permiso para dar de baja material';
  end if;
  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Debes explicar el motivo de la baja';
  end if;

  select physical_stock into v_stock from public.products where id = p_product_id;
  if v_stock is null then
    raise exception 'Producto no encontrado';
  end if;
  if p_quantity > v_stock then
    raise exception 'No puedes dar de baja más de lo que hay en existencia física (%)', v_stock;
  end if;

  update public.products set physical_stock = physical_stock - p_quantity where id = p_product_id;

  insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
  values (p_product_id, 'merma', p_quantity, p_reason, auth.uid());

  insert into public.material_write_offs (product_id, quantity, reason, photo_path, created_by)
  values (p_product_id, p_quantity, p_reason, p_photo_path, auth.uid());
end;
$$;

-- Entradas de mercancía.
create or replace function public.register_inventory_entry(
  p_product_id uuid, p_quantity numeric, p_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.tiene_permiso('kardex_entradas') or public.tiene_permiso('operar_almacen')) then
    raise exception 'No tienes permiso para registrar entradas de inventario';
  end if;
  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
  values (p_product_id, 'entrada', p_quantity, p_reference, auth.uid());

  update public.products set physical_stock = physical_stock + p_quantity where id = p_product_id;
end;
$$;

-- Notificaciones dirigidas a un nivel de almacén (ej. solo el Jefe).
alter table public.notifications add column if not exists target_niveles text[];

drop policy if exists "Los roles ven sus notificaciones" on public.notifications;
create policy "Los roles ven sus notificaciones"
  on public.notifications for select
  using (
    public.current_user_role() is not null
    and (target_roles is null or public.current_user_role() = any (target_roles))
    and (
      target_niveles is null
      or public.current_user_role() <> 'almacen'
      or public.current_nivel_almacen() = any (target_niveles)
    )
  );

-- Reporte de incidente de material (lo usa quien no puede dar de baja).
create or replace function public.reportar_incidente_material(
  p_product_id uuid,
  p_quantity numeric,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_code text;
  v_pname text;
  v_id uuid;
begin
  if not (public.tiene_permiso('operar_almacen') or public.tiene_permiso('dar_de_baja')) then
    raise exception 'No tienes permiso para reportar incidentes de material';
  end if;
  if p_description is null or trim(p_description) = '' then
    raise exception 'Cuenta qué pasó y por qué se debería dar de baja';
  end if;

  select code, name into v_code, v_pname from public.products where id = p_product_id;
  if v_code is null then
    raise exception 'Producto no encontrado';
  end if;
  select full_name into v_name from public.profiles where id = auth.uid();

  insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, created_by)
  values (
    'incidente_material',
    'Incidente de material — ' || v_code,
    coalesce(v_name, 'Un empleado') || ' reporta' ||
      case when p_quantity is not null then ' (' || p_quantity::text || ' afectadas)' else '' end ||
      ' en ' || v_pname || ': ' || trim(p_description) ||
      ' — Si procede, Jefe de almacén o Gerencia dan de baja el material.',
    array['gerencia', 'almacen']::app_role[],
    array['jefe'],
    '/inventario',
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.reportar_incidente_material(uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';
