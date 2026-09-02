-- ============================================================
-- ETAPA — Entregas y retiros parciales (PARTE A: solo el enum)
-- ============================================================
-- IMPORTANTE: este archivo se ejecuta SOLO Y POR SEPARADO, en su
-- propia consulta, antes de la Parte B. Postgres no permite usar un
-- nuevo valor de un tipo enumerado en la misma transacción en la que
-- se agregó, así que si lo juntas con la Parte B, va a fallar.
-- ============================================================

alter type sale_status add value if not exists 'parcial';
