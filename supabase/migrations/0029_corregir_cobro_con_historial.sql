-- ============================================================
-- Corregir el cobro de una venta (Caja o Gerencia) con motivo
-- obligatorio e historial que solo ve Gerencia.
-- ============================================================
-- Requiere haber corrido antes 0026.
-- Es seguro correr este script más de una vez.
--
-- Qué cambia:
--  1) Caja ahora SÍ puede corregir el monto cobrado, pero siempre
--     escribiendo el motivo. Gerencia puede apagarle el permiso
--     "Corregir el monto cobrado" en Administración.
--  2) Cada corrección queda guardada (monto antes / después, método,
--     quién y por qué). Solo Gerencia ve ese historial.
--  3) Cuando Caja corrige, le llega un aviso a Gerencia.
--  4) Las funciones viejas de cobro ya no sirven para cambiar un cobro
--     existente: así nadie lo modifica sin dejar motivo.
-- ============================================================

-- 1) Permiso: corregir_cobros ahora también es de Caja por defecto -----------
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
    when 'corregir_cobros'   then v_role = 'caja'
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

-- 2) Historial de correcciones de cobro -------------------------------------
create table if not exists public.sale_cobro_historial (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  monto_anterior numeric not null,
  monto_nuevo numeric not null,
  metodo_anterior text,
  metodo_nuevo text,
  motivo text not null,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists sale_cobro_historial_sale_idx on public.sale_cobro_historial (sale_id, created_at);

alter table public.sale_cobro_historial enable row level security;

drop policy if exists "Gerencia ve el historial de cobros" on public.sale_cobro_historial;
create policy "Gerencia ve el historial de cobros"
  on public.sale_cobro_historial for select
  using (public.current_user_role() = 'gerencia');

-- 3) Corregir el cobro (la venta ya pasó a almacén) ---------------------------
create or replace function public.corregir_cobro_venta(
  p_sale_id uuid,
  p_monto numeric,
  p_metodo_pago text,
  p_meses_nota text,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_monto numeric := coalesce(p_monto, 0);
  v_metodo text := nullif(trim(coalesce(p_metodo_pago, '')), '');
  v_metodo_final text;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_rol text := public.current_user_role();
begin
  if v_rol not in ('gerencia', 'caja') or not public.tiene_permiso('corregir_cobros') then
    raise exception 'No tienes permiso para corregir cobros';
  end if;
  if v_motivo is null then
    raise exception 'Escribe el motivo de la corrección';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Venta no encontrada';
  end if;
  if v_sale.status = 'cancelada' then
    raise exception 'La venta está cancelada';
  end if;
  if v_sale.liberada_almacen_at is null then
    raise exception 'Esta venta todavía no pasa a almacén: usa "Confirmar cobro"';
  end if;
  if v_monto < 0 then
    raise exception 'El monto no puede ser negativo';
  end if;
  if v_monto > v_sale.total then
    raise exception 'El monto no puede ser mayor al total de la venta ($%)', v_sale.total;
  end if;
  if v_metodo is not null and v_metodo not in ('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'a_meses') then
    raise exception 'Método de pago no válido';
  end if;

  v_metodo_final := coalesce(v_metodo, v_sale.metodo_pago);

  if v_monto = v_sale.amount_paid and v_metodo_final is not distinct from v_sale.metodo_pago then
    raise exception 'No hay nada que corregir: el monto y el método son los mismos';
  end if;

  insert into public.sale_cobro_historial
    (sale_id, monto_anterior, monto_nuevo, metodo_anterior, metodo_nuevo, motivo)
  values
    (p_sale_id, v_sale.amount_paid, v_monto, v_sale.metodo_pago, v_metodo_final, v_motivo);

  update public.sales
  set amount_paid = v_monto,
      payment_confirmed_by = auth.uid(),
      payment_confirmed_at = now(),
      metodo_pago = v_metodo_final,
      meses_nota = case
        when v_metodo_final = 'a_meses'
          then coalesce(nullif(trim(coalesce(p_meses_nota, '')), ''), meses_nota)
        else null
      end
  where id = p_sale_id;

  -- Si Caja corrigió, se le avisa a Gerencia.
  if v_rol <> 'gerencia' then
    insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, related_sale_id, created_by)
    values (
      'cobro_corregido',
      'Cobro corregido — ' || v_sale.folio,
      v_sale.customer_name || ': de $' || to_char(v_sale.amount_paid, 'FM999,999,990.00') ||
        ' a $' || to_char(v_monto, 'FM999,999,990.00') || '. Motivo: ' || v_motivo,
      array['gerencia']::app_role[],
      null,
      '/ventas',
      p_sale_id,
      auth.uid()
    );
  end if;
end;
$$;

grant execute on function public.corregir_cobro_venta(uuid, numeric, text, text, text) to authenticated;

-- 4) Cerrar los caminos viejos para cambiar un cobro sin motivo ---------------
-- 4a) caja_cobrar_venta: solo para el primer cobro (venta que aún está en Caja).
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
  if v_sale.liberada_almacen_at is not null then
    raise exception 'Esta venta ya pasó a almacén. Para cambiar el cobro usa "Corregir cobro" y escribe el motivo';
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

  if v_amount = 0 and not coalesce(p_pasar_sin_cobro, false) then
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
      liberada_almacen_at = now(),
      liberada_almacen_por = auth.uid(),
      liberada_sin_cobro = (v_amount = 0)
  where id = p_sale_id;

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
end;
$$;

grant execute on function public.caja_cobrar_venta(uuid, numeric, text, text, text, boolean) to authenticated;

-- 4b) Función vieja register_sale_payment: ya no puede cambiar un cobro existente.
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
  if coalesce(v_sale.amount_paid, 0) > 0 then
    raise exception 'El cobro ya fue registrado. Para cambiarlo usa "Corregir cobro" y escribe el motivo';
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

notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la migración 0029
-- ============================================================
