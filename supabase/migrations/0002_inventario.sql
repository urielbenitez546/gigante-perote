-- ============================================================
-- ETAPA 3 — Inventario
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001_init_profiles.sql antes)
-- ============================================================

-- 1) Tipo de unidad de medida (caja, pieza, bolsa, etc.)
create type product_unit as enum ('caja', 'pieza', 'bolsa', 'rollo');

-- 2) Tabla de productos
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  brand text not null,
  category text not null,
  unit product_unit not null default 'caja',
  physical_stock numeric not null default 0,
  sold_pending numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3) Tipo de movimiento de inventario
create type movement_type as enum ('entrada', 'salida', 'ajuste');

-- 4) Tabla de movimientos (bitácora de entradas/salidas/ajustes)
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  type movement_type not null,
  quantity numeric not null check (quantity > 0),
  reference text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- 5) Activar RLS en ambas tablas
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;

-- 6) Políticas de "products":
--    a) Gerencia, Ventas y Almacén pueden CONSULTAR productos
create policy "Roles con acceso a inventario pueden ver productos"
  on public.products for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'almacen'));

--    b) Solo Gerencia y Almacén pueden ACTUALIZAR el stock físico
--       (se usa desde la función register_inventory_movement de abajo)
create policy "Gerencia y Almacen pueden actualizar productos"
  on public.products for update
  using (public.current_user_role() in ('gerencia', 'almacen'));

-- 7) Políticas de "inventory_movements":
--    a) Gerencia, Ventas y Almacén pueden CONSULTAR movimientos
create policy "Roles con acceso a inventario pueden ver movimientos"
  on public.inventory_movements for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'almacen'));

--    b) Solo Gerencia y Almacén pueden REGISTRAR movimientos
create policy "Gerencia y Almacen pueden registrar movimientos"
  on public.inventory_movements for insert
  with check (public.current_user_role() in ('gerencia', 'almacen'));

-- 8) Función que registra una entrada de mercancía de forma atómica:
--    inserta el movimiento Y actualiza el stock físico del producto
--    en una sola operación (evita que uno se guarde sin el otro).
create function public.register_inventory_entry(
  p_product_id uuid,
  p_quantity numeric,
  p_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('gerencia', 'almacen') then
    raise exception 'No tienes permiso para registrar entradas de inventario';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
  values (p_product_id, 'entrada', p_quantity, p_reference, auth.uid());

  update public.products
  set physical_stock = physical_stock + p_quantity
  where id = p_product_id;
end;
$$;

grant execute on function public.register_inventory_entry(uuid, numeric, text) to authenticated;

-- ============================================================
-- 9) DATOS DEMO — productos ficticios (NO son productos reales
--    de la empresa; nombres, marcas y existencias son de ejemplo).
-- ============================================================
insert into public.products (code, name, brand, category, unit, physical_stock, sold_pending) values
  ('DEMO-001', 'Piso DEMO Modelo A 60x60',      'Marca DEMO 1', 'Pisos',     'caja',  100, 20),
  ('DEMO-002', 'Azulejo DEMO Modelo B 30x60',   'Marca DEMO 2', 'Azulejos',  'caja',  150, 30),
  ('DEMO-003', 'Mármol DEMO Modelo C 40x40',    'Marca DEMO 3', 'Mármoles',  'pieza',  80, 10),
  ('DEMO-004', 'Pegazulejo DEMO 20kg',          'Marca DEMO 4', 'Adhesivos', 'bolsa', 200, 40),
  ('DEMO-005', 'Boquilla DEMO 10kg',            'Marca DEMO 4', 'Boquillas', 'bolsa', 120, 15),
  ('DEMO-006', 'Piso DEMO Modelo D 45x45',      'Marca DEMO 1', 'Pisos',     'caja',   60, 25),
  ('DEMO-007', 'Azulejo DEMO Modelo E 20x30',   'Marca DEMO 2', 'Azulejos',  'caja',   90, 12),
  ('DEMO-008', 'Mármol DEMO Modelo F Pulido',   'Marca DEMO 3', 'Mármoles',  'pieza',  40,  5);

-- ============================================================
-- Fin de la migración de la Etapa 3
-- ============================================================
