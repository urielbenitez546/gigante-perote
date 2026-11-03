-- ============================================================
-- 0037 — Pedidos a proveedor (Ventas pide, Almacén lo gestiona)
-- ============================================================
-- Cuando un cliente pide algo que no hay en la sucursal, Ventas lo captura
-- en "Pedir a proveedor" (desde Ventas y Entregas). Le llega el aviso a
-- Almacén (jefe y auxiliar) y a Gerencia; Almacén marca "Ya lo pedí" (con
-- proveedor y fecha estimada) y "Ya llegó" (le avisa a Ventas para que
-- registre la venta).
--
-- Estados: pendiente -> pedido -> llego   (o cancelado)
-- Solo se escribe con las funciones de abajo (la tabla está cerrada).
-- Se puede correr más de una vez sin problema.

create sequence if not exists public.pedidos_proveedor_folio_seq;

create table if not exists public.pedidos_proveedor (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  customer_name text not null,
  customer_phone text,
  product_id uuid references public.products (id) on delete set null,
  descripcion text not null,
  cantidad numeric not null check (cantidad > 0),
  nota text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pedido', 'llego', 'cancelado')),
  proveedor text,
  fecha_estimada date,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  pedido_por uuid references auth.users (id),
  pedido_at timestamptz,
  llego_por uuid references auth.users (id),
  llego_at timestamptz,
  cerrado_por uuid references auth.users (id),
  cerrado_at timestamptz,
  motivo_cierre text
);

create index if not exists pedidos_proveedor_estado_idx on public.pedidos_proveedor (estado, created_at desc);

alter table public.pedidos_proveedor enable row level security;

drop policy if exists "Ver pedidos a proveedor" on public.pedidos_proveedor;
create policy "Ver pedidos a proveedor"
  on public.pedidos_proveedor for select
  using (public.current_user_role() in ('gerencia', 'almacen', 'ventas'));

-- 1) Crear el pedido (Ventas y Gerencia) -------------------------------------
create or replace function public.crear_pedido_proveedor(
  p_customer_name text,
  p_customer_phone text,
  p_product_id uuid,
  p_descripcion text,
  p_cantidad numeric,
  p_nota text default null
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

  insert into public.pedidos_proveedor (folio, customer_name, customer_phone, product_id, descripcion, cantidad, nota)
  values (v_folio, v_cliente, nullif(trim(coalesce(p_customer_phone, '')), ''), p_product_id, v_desc, p_cantidad,
          nullif(trim(coalesce(p_nota, '')), ''));

  insert into public.notifications (type, title, message, target_roles, target_niveles, link_path, created_by)
  values (
    'pedido_proveedor',
    'Pedir a proveedor — ' || v_folio,
    v_cliente || ' pide ' || trim(to_char(p_cantidad, 'FM999999990.##')) || ' de ' || v_desc || ' y no hay. Pídelo al proveedor y márcalo en Pedidos a proveedor.',
    array['almacen', 'gerencia']::app_role[],
    array['jefe', 'auxiliar'],
    '/pedidos-proveedor',
    auth.uid()
  );

  return v_folio;
end;
$$;

grant execute on function public.crear_pedido_proveedor(text, text, uuid, text, numeric, text) to authenticated;

-- 2) Almacén: "Ya lo pedí" ---------------------------------------------------
create or replace function public.marcar_pedido_proveedor_pedido(
  p_id uuid,
  p_proveedor text default null,
  p_fecha_estimada date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tiene_permiso('operar_almacen') then
    raise exception 'No tienes permiso para marcar pedidos a proveedor';
  end if;

  update public.pedidos_proveedor
     set estado = 'pedido',
         proveedor = nullif(trim(coalesce(p_proveedor, '')), ''),
         fecha_estimada = p_fecha_estimada,
         pedido_por = auth.uid(),
         pedido_at = now()
   where id = p_id and estado = 'pendiente';

  if not found then
    raise exception 'El pedido no existe o ya no está pendiente';
  end if;
end;
$$;

grant execute on function public.marcar_pedido_proveedor_pedido(uuid, text, date) to authenticated;

-- 3) Almacén: "Ya llegó" (avisa a Ventas) ------------------------------------
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
    'Llegó ' || v.descripcion || ' para ' || v.customer_name || '. Avísale al cliente y registra la venta.',
    array['ventas', 'gerencia']::app_role[],
    null,
    '/pedidos-proveedor',
    auth.uid()
  );
end;
$$;

grant execute on function public.marcar_pedido_proveedor_llego(uuid) to authenticated;

-- 4) Cancelar (quien lo pidió, Gerencia o Almacén con permiso) -----------------
create or replace function public.cancelar_pedido_proveedor(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creador uuid;
begin
  select created_by into v_creador from public.pedidos_proveedor where id = p_id and estado in ('pendiente', 'pedido');
  if not found then
    raise exception 'El pedido no existe o ya está cerrado';
  end if;
  if not (v_creador = auth.uid() or public.tiene_permiso('operar_almacen')) then
    raise exception 'Solo quien lo pidió, Almacén o Gerencia pueden cancelarlo';
  end if;

  update public.pedidos_proveedor
     set estado = 'cancelado', cerrado_por = auth.uid(), cerrado_at = now(),
         motivo_cierre = nullif(trim(coalesce(p_motivo, '')), '')
   where id = p_id;
end;
$$;

grant execute on function public.cancelar_pedido_proveedor(uuid, text) to authenticated;

notify pgrst, 'reload schema';
