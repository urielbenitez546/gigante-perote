-- ============================================================
-- Foto de apoyo del Kardex: ahora la pueden subir y ver
-- Gerencia, todo almacén (jefe, auxiliar, almacenistas) y choferes.
-- ============================================================
-- Requiere haber corrido antes 0027. Es seguro correr más de una vez.

drop policy if exists "Kardex soporte: subir" on storage.objects;
create policy "Kardex soporte: subir"
  on storage.objects for insert
  with check (
    bucket_id = 'kardex-soporte'
    and public.current_user_role() in ('gerencia', 'almacen', 'reparto')
  );

drop policy if exists "Kardex soporte: ver" on storage.objects;
create policy "Kardex soporte: ver"
  on storage.objects for select
  using (
    bucket_id = 'kardex-soporte'
    and public.current_user_role() in ('gerencia', 'almacen', 'reparto')
  );

create or replace function public.kardex_adjuntar_foto(p_movement_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mov record;
begin
  if public.current_user_role() not in ('gerencia', 'almacen', 'reparto') then
    raise exception 'No tienes permiso para adjuntar fotos al Kardex';
  end if;
  if p_path is null or trim(p_path) = '' then
    raise exception 'Falta la foto';
  end if;

  select id, type::text as tipo, foto_path into v_mov
  from public.inventory_movements where id = p_movement_id;
  if v_mov.id is null then
    raise exception 'Renglón del Kardex no encontrado';
  end if;
  if v_mov.tipo not in ('entrada', 'salida') then
    raise exception 'Solo las entradas y salidas llevan foto de apoyo';
  end if;
  if v_mov.foto_path is not null then
    raise exception 'Este renglón ya tiene foto de apoyo';
  end if;

  update public.inventory_movements set foto_path = trim(p_path) where id = p_movement_id;
end;
$$;

grant execute on function public.kardex_adjuntar_foto(uuid, text) to authenticated;
