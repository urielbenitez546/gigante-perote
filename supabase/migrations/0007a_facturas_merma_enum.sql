-- ============================================================
-- Facturas de proveedores y Merma (PARTE A: solo el enum)
-- ============================================================
-- Ejecuta esto SOLO Y POR SEPARADO, antes de la Parte B (mismo
-- motivo que la vez pasada: Postgres no permite usar un valor nuevo
-- de un enum en la misma transacción en la que se agregó).
-- ============================================================

alter type movement_type add value if not exists 'merma';
