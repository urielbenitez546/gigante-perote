-- ============================================================
-- CORRECCIÓN — Ver quién hizo cada cosa (ventas, caja, inventario)
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001 a 0016 antes)
--
-- QUÉ RESUELVE (a petición tuya):
-- El sistema YA guardaba quién registró cada venta, cada movimiento
-- de inventario, cada factura, cada merma y cada cobro — pero nadie
-- lo podía VER en la pantalla, porque antes de esta corrección cada
-- quien solo podía consultar su propio perfil (o Gerencia, todos).
-- Eso no sirve para que un empleado se pueda "defender" mostrando
-- que él sí hizo bien su parte, o para que Gerencia audite rápido
-- sin entrar a Supabase.
--
-- Se agrega un permiso para que CUALQUIER usuario con sesión válida
-- pueda ver el nombre y correo de sus compañeros (no solo Gerencia).
-- Esto NO cambia quién puede EDITAR nada — solo permite leer nombres
-- para mostrar "Vendedor: Fulano", "Registrado por: Fulano", etc.
-- ============================================================

drop policy if exists "Todos los roles pueden ver nombres de compañeros" on public.profiles;
create policy "Todos los roles pueden ver nombres de compañeros"
  on public.profiles for select
  using (public.current_user_role() is not null);

notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la corrección
-- ============================================================
