-- ============================================================
-- Foto del producto: aparece junto al nombre en el Kardex y en la
-- ficha del producto, para que se vea si el material coincide.
-- ============================================================
-- Es seguro correr este script más de una vez.
--  - Gerencia, todo almacén y choferes pueden poner o cambiar la foto.
--  - Todos los usuarios con sesión la pueden ver (bucket público de lectura).

alter table public.products add column if not exists foto_path text;

insert into storage.buckets (id, name, public)
values ('productos-fotos', 'productos-fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "Fotos de productos: subir" on storage.objects;
create policy "Fotos de productos: subir"
  on storage.objects for insert
  with check (
    bucket_id = 'productos-fotos'
    and public.current_user_role() in ('gerencia', 'almacen', 'reparto')
  );

drop policy if exists "Fotos de productos: ver" on storage.objects;
create policy "Fotos de productos: ver"
  on storage.objects for select
  using (bucket_id = 'productos-fotos');

-- Guarda (o cambia) la foto de un producto.
-- p_solo_si_no_tiene = true: si el producto ya tiene foto, no la cambia.
create or replace function public.producto_guardar_foto(
  p_product_id uuid,
  p_path text,
  p_solo_si_no_tiene boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('gerencia', 'almacen', 'reparto') then
    raise exception 'No tienes permiso para cambiar la foto del producto';
  end if;
  if p_path is null or trim(p_path) = '' then
    raise exception 'Falta la foto';
  end if;

  update public.products
     set foto_path = trim(p_path)
   where id = p_product_id
     and (not p_solo_si_no_tiene or foto_path is null);

  if not found and not p_solo_si_no_tiene then
    raise exception 'Producto no encontrado';
  end if;
end;
$$;

grant execute on function public.producto_guardar_foto(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';
