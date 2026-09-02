-- ============================================================
-- CORRECCIÓN — Puesto real del empleado (distinto del rol del sistema)
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001 a 0017 antes)
--
-- QUÉ RESUELVE (a petición tuya):
-- El "rol" del sistema (gerencia/ventas/caja/almacen/reparto) solo
-- controla PERMISOS — no describe el puesto real de la persona. Dos
-- personas pueden tener el mismo rol "almacen" pero un puesto
-- distinto (ej. "Jefe de Almacén" y "Auxiliar de Inventario"). Se
-- agrega un campo de texto libre "puesto" (opcional, lo llena
-- Gerencia desde Administración) que se muestra junto al nombre en
-- todo el sistema — Ventas, Inventario, Evidencias y Cobros, etc. —
-- sin afectar en nada los permisos.
-- ============================================================

alter table public.profiles add column if not exists puesto text;

-- ============================================================
-- Fin de la corrección
-- ============================================================
