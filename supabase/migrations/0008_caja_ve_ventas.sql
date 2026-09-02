-- ============================================================
-- Caja también puede CONSULTAR Ventas (para cobrar por folio)
-- ============================================================
-- Ejecuta esto en una consulta nueva de tu Supabase.
-- Caja sigue sin poder crear ni editar ventas (eso sigue siendo
-- exclusivo de Gerencia y Ventas, sin cambios).
-- ============================================================

drop policy if exists "Roles con acceso a ventas/retiros pueden ver ventas" on public.sales;
create policy "Roles con acceso a ventas/retiros pueden ver ventas"
  on public.sales for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'almacen', 'reparto', 'caja'));

drop policy if exists "Roles con acceso a ventas/retiros pueden ver renglones" on public.sale_items;
create policy "Roles con acceso a ventas/retiros pueden ver renglones"
  on public.sale_items for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'almacen', 'reparto', 'caja'));
