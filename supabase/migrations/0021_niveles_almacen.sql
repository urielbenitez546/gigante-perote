-- ============================================================
-- Niveles dentro de "Almacén": jefe, auxiliar y almacenista
-- ============================================================
-- Ejecuta esto en: Supabase Dashboard > SQL Editor > New query
-- El rol del sistema sigue siendo "almacen" para los tres; el nivel
-- decide cuánto pueden modificar. Las cuentas de almacén que ya
-- existen quedan como "jefe" (nada cambia para ellas).
-- ============================================================

alter table public.profiles
  add column if not exists nivel_almacen text not null default 'jefe'
  check (nivel_almacen in ('jefe', 'auxiliar', 'almacenista'));

-- Nivel de quien está conectado (null si no es de almacén).
create or replace function public.current_nivel_almacen()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nivel_almacen from public.profiles
  where id = auth.uid() and role = 'almacen';
$$;

grant execute on function public.current_nivel_almacen() to authenticated;

-- Solo Gerencia y el Jefe de almacén pueden editar productos
-- (precio, rotación, datos de etiqueta) directamente.
drop policy if exists "Gerencia y Almacen pueden actualizar productos" on public.products;
create policy "Gerencia y Jefe de almacen pueden actualizar productos"
  on public.products for update
  using (
    public.current_user_role() = 'gerencia'
    or (public.current_user_role() = 'almacen' and public.current_nivel_almacen() = 'jefe')
  );

-- Dar de baja material (merma): el almacenista no puede.
create or replace function public.register_write_off(
  p_product_id uuid,
  p_quantity numeric,
  p_reason text,
  p_photo_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
begin
  if public.current_user_role() not in ('gerencia', 'almacen')
     or (public.current_user_role() = 'almacen' and public.current_nivel_almacen() = 'almacenista') then
    raise exception 'No tienes permiso para dar de baja material';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Debes explicar el motivo de la baja';
  end if;

  select physical_stock into v_stock from public.products where id = p_product_id;
  if v_stock is null then
    raise exception 'Producto no encontrado';
  end if;
  if p_quantity > v_stock then
    raise exception 'No puedes dar de baja más de lo que hay en existencia física (%)', v_stock;
  end if;

  update public.products set physical_stock = physical_stock - p_quantity where id = p_product_id;

  insert into public.inventory_movements (product_id, type, quantity, reference, created_by)
  values (p_product_id, 'merma', p_quantity, p_reason, auth.uid());

  insert into public.material_write_offs (product_id, quantity, reason, photo_path, created_by)
  values (p_product_id, p_quantity, p_reason, p_photo_path, auth.uid());
end;
$$;

notify pgrst, 'reload schema';
