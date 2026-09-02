-- ============================================================
-- Facturas de proveedores y Merma (PARTE B)
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto DESPUÉS de la Parte A (0007a), en una consulta nueva.
-- Requiere que ya hayas creado los buckets de Storage "facturas" y
-- "merma" (públicos) desde el Dashboard.
--
-- A petición del jefe de almacén:
-- - Registrar facturas semanales de entrada de mercancía, con número
--   de factura, proveedor, foto de la factura, y desglose por
--   producto (que ya incluye marca/categoría, del Inventario).
-- - Dar de baja material dañado, con foto y motivo.
-- Ambas acciones descuentan/aumentan el inventario real de forma
-- atómica, igual que "Registrar entrada" de la Etapa 3.
-- Solo Gerencia y Almacén pueden hacer ambas cosas.
-- ============================================================

-- 1) Políticas de Storage: solo Gerencia y Almacén pueden SUBIR
--    archivos a estos dos buckets (la lectura ya es pública porque
--    los buckets se crearon como "Public").
create policy "Gerencia y Almacen pueden subir facturas"
  on storage.objects for insert
  with check (bucket_id = 'facturas' and public.current_user_role() in ('gerencia', 'almacen'));

create policy "Gerencia y Almacen pueden subir evidencia de merma"
  on storage.objects for insert
  with check (bucket_id = 'merma' and public.current_user_role() in ('gerencia', 'almacen'));

-- 2) Tabla de facturas de proveedores (encabezado)
create table public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  supplier text not null,
  photo_path text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- 3) Renglones de la factura (qué productos y cuánto trajo)
create table public.purchase_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.purchase_invoices (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity numeric not null check (quantity > 0)
);

alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_items enable row level security;

create policy "Gerencia y Almacen pueden ver facturas"
  on public.purchase_invoices for select
  using (public.current_user_role() in ('gerencia', 'almacen'));

create policy "Gerencia y Almacen pueden ver renglones de factura"
  on public.purchase_invoice_items for select
  using (public.current_user_role() in ('gerencia', 'almacen'));

-- 4) Función: registra una factura completa (encabezado + renglones)
--    y aumenta la existencia física de cada producto, dejando su
--    huella en "inventory_movements" (igual que una entrada normal).
create function public.register_purchase_invoice(
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
  if public.current_user_role() not in ('gerencia', 'almacen') then
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

grant execute on function public.register_purchase_invoice(text, text, text, jsonb) to authenticated;

-- 5) Tabla de bajas de material dañado
create table public.material_write_offs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  reason text not null,
  photo_path text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.material_write_offs enable row level security;

create policy "Gerencia y Almacen pueden ver bajas de material"
  on public.material_write_offs for select
  using (public.current_user_role() in ('gerencia', 'almacen'));

-- 6) Función: da de baja material dañado (descuenta existencia
--    física real y deja evidencia con foto y motivo).
create function public.register_write_off(
  p_product_id uuid,
  p_quantity numeric,
  p_reason text,
  p_photo_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
begin
  if public.current_user_role() not in ('gerencia', 'almacen') then
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

grant execute on function public.register_write_off(uuid, numeric, text, text) to authenticated;

-- ============================================================
-- Fin de la Parte B
-- ============================================================
