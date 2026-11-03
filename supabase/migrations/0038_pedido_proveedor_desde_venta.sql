-- ============================================================
-- 0038 — "Pedir a proveedor" desde la venta
-- ============================================================
-- En Nueva venta, si un producto no alcanza o hay poco, el vendedor puede
-- elegir "Pedir a proveedor" en ese producto. Al registrar la venta se crea
-- el pedido a proveedor (lo que falta) ligado al folio de la venta, y le
-- llega el aviso a Almacén. Requiere haber corrido 0037.
-- Se puede correr más de una vez sin problema.

alter table public.pedidos_proveedor add column if not exists venta_folio text;

-- La función cambia de firma (se agrega p_venta_folio): se quita la anterior.
drop function if exists public.crear_pedido_proveedor(text, text, uuid, text, numeric, text);

create or replace function public.crear_pedido_proveedor(
  p_customer_name text,
  p_customer_phone text,
  p_product_id uuid,
  p_descripcion text,
  p_cantidad numeric,
  p_nota text default null,
  p_venta_folio text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folio text;
  v_desc text := nullif(trim(coalesce(p_descripcion, '')), '');
  v_cliente text := nullif(trim(coalesce(p_customer_name, '')), '');
  v_venta text := nullif(trim(coalesce(p_venta_folio, '')), '');
  v_name text;
begin
  if public.current_user_role() not in ('ventas', 'gerencia') then
    raise exception 'Solo Ventas y Gerencia piden material a proveedor';
  end if;
  if v_cliente is null then
    raise exception 'Escribe el nombre del cliente';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  if p_product_id is not null then
    select name into v_name from public.products where id = p_product_id;
    if v_name is null then
      raise exception 'Producto no encontrado';
    end if;
    v_desc := coalesce(v_desc, v_name);
  end if;
  if v_desc is null then
    raise exception 'Elige el producto o escribe qué material es';
  end if;

  v_folio := 'PP-' || lpad(nextval('public.pedidos_proveedor_folio_seq')::text, 6, '0');

  insert into public.pedidos_proveedor (folio, customer_name, customer_phone, product_id, descripcion, cantidad, nota, venta_folio)
  values (v_folio, v_cliente, nullif(trim(coalesce(p_customer_phone, '')), ''), p_product_id, v_desc, p_cantidad,
          nullif(trim(coalesce(p_nota, '')), ''), v_venta);

  insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, created_by)
  values (
    'pedido_proveedor',
    'Pedir a proveedor — ' || v_folio,
    v_cliente || ' pide ' || trim(to_char(p_cantidad, 'FM999999990.##')) || ' de ' || v_desc
      || case when v_venta is not null then ' (venta ' || v_venta || ')' else '' end
      || ' y no hay suficiente. Pídelo al proveedor y márcalo en Pedidos a proveedor.',
    array['almacen', 'gerencia']::app_role[],
    array['jefe', 'auxiliar'],
    '/pedidos-proveedor',
    auth.uid()
  );

  return v_folio;
end;
$$;

grant execute on function public.crear_pedido_proveedor(text, text, uuid, text, numeric, text, text) to authenticated;

-- Aviso de "ya llegó": menciona la venta si el pedido salió de una.
create or replace function public.marcar_pedido_proveedor_llego(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  if not public.tiene_permiso('operar_almacen') then
    raise exception 'No tienes permiso para marcar pedidos a proveedor';
  end if;

  update public.pedidos_proveedor
     set estado = 'llego', llego_por = auth.uid(), llego_at = now()
   where id = p_id and estado in ('pendiente', 'pedido')
  returning * into v;

  if not found then
    raise exception 'El pedido no existe o ya está cerrado';
  end if;

  insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, created_by)
  values (
    'pedido_proveedor_llego',
    'Ya llegó el material — ' || v.folio,
    'Llegó ' || v.descripcion || ' para ' || v.customer_name
      || case when v.venta_folio is not null
              then ' (venta ' || v.venta_folio || '). Avísale al cliente para completar su entrega.'
              else '. Avísale al cliente y registra la venta.' end,
    array['ventas', 'gerencia']::app_role[],
    null,
    '/pedidos-proveedor',
    auth.uid()
  );
end;
$$;

grant execute on function public.marcar_pedido_proveedor_llego(uuid) to authenticated;

notify pgrst, 'reload schema';
