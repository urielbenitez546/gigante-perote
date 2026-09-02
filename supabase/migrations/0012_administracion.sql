-- ============================================================
-- ETAPA 9 — Administración de usuarios y roles
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- (Requiere que ya hayas ejecutado 0001 a 0011 antes)
--
-- NOTA TÉCNICA: este script es SEGURO de correr más de una vez.
--
-- QUÉ RESUELVE:
-- Hasta ahora, crear un usuario nuevo y asignarle su nombre/rol se
-- hacía a mano en el Table Editor de Supabase (ver Etapa 1 del
-- README) — eso NO cambia aquí: crear un usuario de Auth (correo +
-- contraseña) sigue siendo un paso manual tuyo en el Dashboard, ya
-- que hacerlo desde el sitio requeriría exponer la clave
-- "service_role" en el navegador, y eso nunca es seguro.
--
-- Lo que SÍ agrega esta etapa es una pantalla real dentro del sitio
-- (solo para Gerencia) para: ver la lista de empleados con su correo,
-- cambiarles el nombre o el rol, y darlos de baja/alta sin tener que
-- entrar a Supabase. La tabla "profiles" y sus permisos (RLS) para
-- que Gerencia vea/actualice todos los perfiles YA EXISTÍAN desde la
-- Etapa 1 — aquí solo se le agrega la columna de correo (para poder
-- identificar a cada quién sin adivinar por el nombre) y, más
-- importante, se hace que el campo "active" (que ya existía pero no
-- tenía ningún efecto real) SÍ bloquee el acceso: un usuario dado de
-- baja ya no puede entrar al sitio aunque su contraseña siga siendo
-- válida (ver el cambio correspondiente en el frontend,
-- ProtectedRoute.tsx).
-- ============================================================

-- 1) Columna de correo en "profiles" (antes solo vivía en Auth).
alter table public.profiles add column if not exists email text;

-- 2) Recupera el correo de los usuarios que ya existían, para que no
--    aparezcan en blanco en la nueva pantalla.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- 3) A partir de ahora, guarda el correo automáticamente cuando se
--    cree un usuario nuevo (mismo trigger de la Etapa 1, con una
--    línea agregada).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'ventas'),
    new.email
  );
  return new;
end;
$$;

-- ============================================================
-- Fin de la migración de la Etapa 9
-- ============================================================
