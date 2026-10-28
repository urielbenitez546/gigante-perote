-- ============================================================
-- 0035a — Nueva unidad "m²" (metraje) para pisos y azulejos
-- ============================================================
-- Corre ESTE archivo primero y solo. Luego corre 0035b.
-- (Supabase necesita guardar la unidad nueva antes de poder usarla.)
alter type product_unit add value if not exists 'm2';
