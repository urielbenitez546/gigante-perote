-- 0043: la etiqueta amarilla del Kardex se guarda por producto.
-- Lo que se llena una vez (tipo, renglones de abajo, tamaño, fondo) queda guardado
-- y al abrir la etiqueta de ese producto ya aparece lleno.
alter table public.products add column if not exists etiqueta_kardex jsonb;
alter table public.products add column if not exists etiqueta_kardex_at timestamptz;
alter table public.products add column if not exists etiqueta_kardex_por uuid;

create or replace function public.guardar_etiqueta_kardex(p_product_id uuid, p_datos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.tiene_permiso('kardex_entradas') or public.tiene_permiso('operar_almacen')) then
    raise exception 'No tienes permiso para guardar los datos de la etiqueta';
  end if;
  if p_datos is not null and jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Datos de etiqueta no válidos';
  end if;

  update public.products
     set etiqueta_kardex = p_datos,
         etiqueta_kardex_at = case when p_datos is null then null else now() end,
         etiqueta_kardex_por = case when p_datos is null then null else auth.uid() end
   where id = p_product_id;
end;
$$;

grant execute on function public.guardar_etiqueta_kardex(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
