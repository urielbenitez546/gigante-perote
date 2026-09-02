-- ============================================================
-- ETAPA 1 — Autenticación y perfiles con rol (VERSIÓN FINAL)
-- Proyecto: El Gigante de los Azulejos y Mármoles (Sucursal Perote)
-- ============================================================
-- Este script se pega y ejecuta UNA sola vez en:
-- Supabase Dashboard > SQL Editor > New query
--
-- HISTORIAL DE CORRECCIONES (para contexto futuro):
-- Un primer intento hizo que las políticas de "Gerencia puede ver/
-- actualizar todos los perfiles" consultaran "public.profiles" desde
-- una política de la propia tabla "profiles", provocando
-- "infinite recursion detected in policy for relation profiles".
-- Se intentó resolver con una función SECURITY DEFINER, y luego
-- agregando "set row_security = off" y "language plpgsql" (para
-- evitar que el planificador "pusiera en línea" la función), pero
-- el problema persistió: en este proyecto, el rol que ejecuta las
-- funciones no tiene el privilegio BYPASSRLS, así que NINGUNA
-- función que consulte "profiles" desde dentro de una política de
-- "profiles" puede evitar la recursión, sin importar cómo esté
-- escrita esa función.
--
-- SOLUCIÓN DEFINITIVA: se deja de consultar "profiles" desde la
-- política por completo. En su lugar, existe una tabla espejo
-- "public.user_roles" (solo user_id + role) que NUNCA tiene RLS
-- habilitado -> es físicamente imposible que provoque recursión,
-- sin importar privilegios de roles. Esa tabla no se expone
-- directamente a la API (se le revocan permisos a "anon" y
-- "authenticated"); solo la función "current_user_role()" la lee,
-- y se mantiene sincronizada automáticamente mediante un trigger
-- cada vez que cambia "profiles.role".
--
-- NOTA: al ejecutar este script, Supabase puede advertir "This query
-- creates a table without enabling Row Level Security" para
-- "user_roles". Es intencional — da clic en "Run without RLS". Esa
-- tabla ya está protegida de otra forma (revoke de acceso directo),
-- y es precisamente la ausencia de RLS en ella lo que evita la
-- recursión.
-- ============================================================

-- 1) Tipo enumerado con los 5 roles funcionales confirmados
create type app_role as enum ('gerencia', 'ventas', 'caja', 'almacen', 'reparto');

-- 2) Tabla de perfiles, 1 a 1 con auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3) Cuando se crea un usuario en Supabase Auth, se crea automáticamente
--    su fila en "profiles" leyendo full_name y role desde los metadatos
--    del usuario (user_metadata), que se llenan al crear el usuario
--    manualmente desde el Dashboard (ver instrucciones del README).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'ventas')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4) Tabla espejo SIN row level security. Guarda únicamente el rol
--    de cada usuario. Al no tener RLS habilitado, consultarla nunca
--    puede disparar una recursión de políticas.
create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role app_role not null
);

-- Se bloquea el acceso directo vía API: nadie puede leer/escribir esta
-- tabla directamente desde el frontend, solo a través de la función
-- de abajo (que corre con privilegios del propietario).
revoke all on public.user_roles from anon, authenticated, public;

-- 5) Trigger que mantiene "user_roles" sincronizada automáticamente
--    cada vez que se crea o cambia el rol en "profiles".
create function public.sync_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, new.role)
  on conflict (user_id) do update set role = excluded.role;
  return new;
end;
$$;

create trigger on_profile_role_sync
  after insert or update of role on public.profiles
  for each row execute procedure public.sync_user_role();

-- 6) Función que expone el rol del usuario actual, leyendo de la
--    tabla espejo (sin RLS) en vez de "profiles" -> sin recursión.
create function public.current_user_role()
returns app_role
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return (select role from public.user_roles where user_id = auth.uid());
end;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- 7) Activar RLS (Row Level Security) en profiles
alter table public.profiles enable row level security;

-- 8) Políticas:
--    a) Cualquier usuario autenticado puede leer SU PROPIO perfil
create policy "Los usuarios pueden ver su propio perfil"
  on public.profiles for select
  using (auth.uid() = id);

--    b) Gerencia puede ver TODOS los perfiles (para Administración)
create policy "Gerencia puede ver todos los perfiles"
  on public.profiles for select
  using (public.current_user_role() = 'gerencia');

--    c) Solo Gerencia puede actualizar perfiles (roles/estado activo)
create policy "Gerencia puede actualizar perfiles"
  on public.profiles for update
  using (public.current_user_role() = 'gerencia');

-- Nota: no se agrega política de "insert" ni "delete" para usuarios
-- normales a propósito. Los perfiles se crean únicamente vía el
-- trigger "on_auth_user_created". Esto se revisará si Administración
-- necesita eliminar usuarios en una etapa posterior.

-- ============================================================
-- Fin de la migración de la Etapa 1 (versión final)
-- ============================================================
