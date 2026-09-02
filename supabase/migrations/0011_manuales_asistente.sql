-- ============================================================
-- ETAPA 7 — Manuales e Información + Asistente de Consulta
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001 a 0010 antes)
--
-- IMPORTANTE — paso manual previo (igual que con "facturas"/"merma"
-- y "repartos-firmas"/"repartos-evidencia"): antes de correr este
-- script, crea en el Dashboard de Supabase (Storage) un bucket nuevo
-- llamado "manuales", como "Public" (puede llevar PDFs o imágenes).
--
-- NOTA TÉCNICA: este script es SEGURO de correr más de una vez (es
-- "idempotente"). El editor de SQL de Supabase va aplicando cada
-- instrucción por separado (no como una sola transacción grande), así
-- que si algo se interrumpe a la mitad, o le das "Run" dos veces por
-- error, no truena con errores de "ya existe" — simplemente no
-- vuelve a crear lo que ya estaba.
--
-- QUÉ RESUELVE:
-- - "Manuales e Información": un repositorio de documentos (manual
--   de bienvenida, descripciones de puesto, protocolos, políticas)
--   y de preguntas frecuentes, visible para los 5 roles y filtrable
--   por a quién le corresponde cada uno. Solo Gerencia puede
--   publicar/editar/eliminar contenido — el resto solo consulta.
-- - "Asistente de Consulta": NO es un asistente con inteligencia
--   artificial de pago (eso tendría costo por cada pregunta). Es un
--   buscador por palabras clave sobre los manuales y las preguntas
--   frecuentes ya registradas, para que un empleado con una duda no
--   tenga que adivinar en qué pestaña está la respuesta. Toda la
--   lógica de búsqueda vive en el frontend (src/lib/search.ts); esta
--   migración solo crea las tablas de donde se lee.
-- ============================================================

-- 1) Categoría de manuales/FAQ (para poder filtrar y organizar).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'manual_category') then
    create type manual_category as enum ('bienvenida', 'puesto', 'protocolo', 'politica', 'otro');
  end if;
end $$;

-- 2) Política de Storage: solo Gerencia puede SUBIR archivos al
--    bucket de manuales (la lectura ya es pública porque el bucket
--    se creó como "Public").
drop policy if exists "Gerencia puede subir archivos de manuales" on storage.objects;
create policy "Gerencia puede subir archivos de manuales"
  on storage.objects for insert
  with check (bucket_id = 'manuales' and public.current_user_role() = 'gerencia');

-- 3) Tabla de manuales/documentos.
create table if not exists public.manuals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category manual_category not null default 'otro',
  -- NULL = aplica para todos los roles; si no, solo para los roles listados.
  target_roles app_role[],
  file_path text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- 4) Tabla de preguntas frecuentes.
create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category manual_category,
  target_roles app_role[],
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.manuals enable row level security;
alter table public.faq_entries enable row level security;

-- 5) Políticas: cualquier usuario con un rol válido (los 5) puede
--    CONSULTAR manuales y FAQ. El filtrado de "para quién es" se
--    hace en el frontend, ya que aquí solo importa que tenga sesión
--    con un perfil activo.
drop policy if exists "Todos los roles pueden ver manuales" on public.manuals;
create policy "Todos los roles pueden ver manuales"
  on public.manuals for select
  using (public.current_user_role() is not null);

drop policy if exists "Todos los roles pueden ver preguntas frecuentes" on public.faq_entries;
create policy "Todos los roles pueden ver preguntas frecuentes"
  on public.faq_entries for select
  using (public.current_user_role() is not null);

-- 6) Políticas: solo Gerencia puede crear, editar o eliminar.
drop policy if exists "Gerencia puede crear manuales" on public.manuals;
create policy "Gerencia puede crear manuales"
  on public.manuals for insert
  with check (public.current_user_role() = 'gerencia');

drop policy if exists "Gerencia puede editar manuales" on public.manuals;
create policy "Gerencia puede editar manuales"
  on public.manuals for update
  using (public.current_user_role() = 'gerencia');

drop policy if exists "Gerencia puede eliminar manuales" on public.manuals;
create policy "Gerencia puede eliminar manuales"
  on public.manuals for delete
  using (public.current_user_role() = 'gerencia');

drop policy if exists "Gerencia puede crear preguntas frecuentes" on public.faq_entries;
create policy "Gerencia puede crear preguntas frecuentes"
  on public.faq_entries for insert
  with check (public.current_user_role() = 'gerencia');

drop policy if exists "Gerencia puede editar preguntas frecuentes" on public.faq_entries;
create policy "Gerencia puede editar preguntas frecuentes"
  on public.faq_entries for update
  using (public.current_user_role() = 'gerencia');

drop policy if exists "Gerencia puede eliminar preguntas frecuentes" on public.faq_entries;
create policy "Gerencia puede eliminar preguntas frecuentes"
  on public.faq_entries for delete
  using (public.current_user_role() = 'gerencia');

-- 7) Por si acaso, fuerza a Supabase a recargar su caché de tablas.
notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la migración de la Etapa 7
-- ============================================================
