-- ============================================================
-- CORRECCIÓN — Permisos de productos para Caja y Reparto
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en una consulta nueva de tu Supabase.
--
-- QUÉ RESUELVE:
-- Desde la Etapa 2, solo Gerencia, Ventas y Almacén podían leer la
-- tabla "products" (código, nombre, unidad, etc.). Caja y Reparto
-- nunca se agregaron ahí, aunque sí necesitan ver esa información:
-- Caja para confirmar cobros en "Evidencias y Cobros" (que muestra
-- de qué venta viene cada reparto) y Reparto para ver qué productos
-- lleva en cada viaje. Al faltar ese permiso, esos datos venían
-- incompletos y provocaban que la pantalla se quedara en blanco
-- para esos roles (sin ningún aviso de error).
-- ============================================================

drop policy if exists "Roles con acceso a inventario pueden ver productos" on public.products;
create policy "Roles con acceso a inventario pueden ver productos"
  on public.products for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'almacen', 'caja', 'reparto'));

notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la corrección
-- ============================================================
