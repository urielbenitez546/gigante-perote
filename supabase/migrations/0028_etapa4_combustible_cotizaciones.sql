-- ============================================================
-- Etapa 4: Bitácora de combustible (vehículos y montacargas) y Cotizaciones
-- ============================================================
-- Requiere haber corrido antes 0025, 0026 y 0027.
-- Es seguro correr este script más de una vez.
-- ============================================================

-- ------------------------------------------------------------
-- A) Bitácora de combustible
-- ------------------------------------------------------------
create table if not exists public.bitacora_combustible (
  id uuid primary key default gen_random_uuid(),
  tipo_unidad text not null check (tipo_unidad in ('vehiculo', 'montacargas')),
  unidad text not null,
  fecha date not null default current_date,
  litros numeric not null check (litros > 0),
  monto numeric check (monto is null or monto >= 0),
  -- Kilómetros del vehículo u horas del montacargas, según el tablero.
  odometro numeric check (odometro is null or odometro >= 0),
  foto_ticket text,
  foto_tablero text,
  notas text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  anulado_at timestamptz,
  anulado_por uuid references auth.users (id),
  anulado_motivo text
);

alter table public.bitacora_combustible enable row level security;

-- Gerencia, jefe y auxiliar (permiso ver_km) ven todo; cada quien ve lo que él mismo registró.
drop policy if exists "Ver bitácora de combustible" on public.bitacora_combustible;
create policy "Ver bitácora de combustible"
  on public.bitacora_combustible for select
  using (public.tiene_permiso('ver_km') or created_by = auth.uid());

-- Fotos (bucket privado "bitacora")
insert into storage.buckets (id, name, public)
values ('bitacora', 'bitacora', false)
on conflict (id) do nothing;

drop policy if exists "Bitácora: subir fotos" on storage.objects;
create policy "Bitácora: subir fotos"
  on storage.objects for insert
  with check (bucket_id = 'bitacora' and public.current_user_role() in ('gerencia', 'reparto', 'almacen'));

drop policy if exists "Bitácora: ver fotos" on storage.objects;
create policy "Bitácora: ver fotos"
  on storage.objects for select
  using (bucket_id = 'bitacora' and (public.tiene_permiso('ver_km') or owner = auth.uid()));

create or replace function public.registrar_combustible(
  p_tipo_unidad text,
  p_unidad text,
  p_fecha date,
  p_litros numeric,
  p_monto numeric default null,
  p_odometro numeric default null,
  p_foto_ticket text default null,
  p_foto_tablero text default null,
  p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_user_role();
  v_unidad text := nullif(trim(coalesce(p_unidad, '')), '');
  v_ultimo numeric;
  v_id uuid;
begin
  if v_role not in ('gerencia', 'reparto', 'almacen') then
    raise exception 'No tienes permiso para registrar combustible';
  end if;
  if p_tipo_unidad not in ('vehiculo', 'montacargas') then
    raise exception 'Elige si es un vehículo o un montacargas';
  end if;
  if v_role = 'reparto' and p_tipo_unidad <> 'vehiculo' then
    raise exception 'Reparto registra combustible de vehículos';
  end if;
  if v_role = 'almacen' and p_tipo_unidad <> 'montacargas' then
    raise exception 'Almacén registra combustible del montacargas';
  end if;
  if v_unidad is null then
    raise exception 'Escribe qué unidad es (placas, número o nombre)';
  end if;
  if p_litros is null or p_litros <= 0 then
    raise exception 'Los litros deben ser mayores a cero';
  end if;
  if coalesce(p_fecha, current_date) > current_date then
    raise exception 'La fecha no puede ser futura';
  end if;

  if p_odometro is not null then
    select max(odometro) into v_ultimo
    from public.bitacora_combustible
    where tipo_unidad = p_tipo_unidad and lower(unidad) = lower(v_unidad)
      and anulado_at is null and odometro is not null;
    if v_ultimo is not null and p_odometro < v_ultimo then
      raise exception 'El kilometraje/horas (%) es menor al último registro de esta unidad (%). Revisa el tablero.',
        p_odometro, v_ultimo;
    end if;
  end if;

  insert into public.bitacora_combustible
    (tipo_unidad, unidad, fecha, litros, monto, odometro, foto_ticket, foto_tablero, notas)
  values
    (p_tipo_unidad, v_unidad, coalesce(p_fecha, current_date), p_litros, p_monto, p_odometro,
     nullif(trim(coalesce(p_foto_ticket, '')), ''), nullif(trim(coalesce(p_foto_tablero, '')), ''),
     nullif(trim(coalesce(p_notas, '')), ''))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.registrar_combustible(text, text, date, numeric, numeric, numeric, text, text, text) to authenticated;

create or replace function public.anular_registro_combustible(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'gerencia' then
    raise exception 'Solo Gerencia puede anular un registro de combustible';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'Escribe el motivo';
  end if;
  update public.bitacora_combustible
  set anulado_at = now(), anulado_por = auth.uid(), anulado_motivo = trim(p_motivo)
  where id = p_id and anulado_at is null;
  if not found then
    raise exception 'Registro no encontrado o ya anulado';
  end if;
end;
$$;

grant execute on function public.anular_registro_combustible(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- B) Cotizaciones
-- ------------------------------------------------------------
create sequence if not exists public.cotizaciones_folio_seq;

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  notas text,
  vigencia_hasta date not null,
  status text not null default 'abierta' check (status in ('abierta', 'convertida', 'cancelada')),
  total numeric not null default 0,
  sale_folio text,
  motivo_cancelacion text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  cerrada_at timestamptz
);

create table if not exists public.cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null default 0,
  tipo_precio text not null default 'publico' check (tipo_precio in ('publico', 'promocion'))
);

alter table public.cotizaciones enable row level security;
alter table public.cotizacion_items enable row level security;

drop policy if exists "Ver cotizaciones" on public.cotizaciones;
create policy "Ver cotizaciones"
  on public.cotizaciones for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'caja'));

drop policy if exists "Ver renglones de cotizaciones" on public.cotizacion_items;
create policy "Ver renglones de cotizaciones"
  on public.cotizacion_items for select
  using (public.current_user_role() in ('gerencia', 'ventas', 'caja'));

-- Los precios se calculan igual que en register_sale (público o promoción).
create or replace function public.crear_cotizacion(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_vigencia_dias integer,
  p_notas text,
  p_items jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_folio text;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_tipo text;
  v_unit_price numeric;
  v_descuento numeric;
  v_lista numeric;
  v_precio numeric;
  v_dias integer := greatest(coalesce(p_vigencia_dias, 7), 1);
begin
  if public.current_user_role() not in ('gerencia', 'ventas') then
    raise exception 'No tienes permiso para crear cotizaciones';
  end if;
  if p_customer_name is null or trim(p_customer_name) = '' then
    raise exception 'El nombre del cliente es obligatorio';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La cotización debe tener al menos un producto';
  end if;

  v_folio := 'C-' || nextval('public.cotizaciones_folio_seq');

  insert into public.cotizaciones (folio, customer_name, customer_phone, customer_address, notas, vigencia_hasta)
  values (
    v_folio, trim(p_customer_name),
    nullif(trim(coalesce(p_customer_phone, '')), ''),
    nullif(trim(coalesce(p_customer_address, '')), ''),
    nullif(trim(coalesce(p_notas, '')), ''),
    current_date + v_dias
  )
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_tipo := case when lower(coalesce(v_item ->> 'tipo_precio', 'publico')) = 'promocion'
                   then 'promocion' else 'publico' end;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero';
    end if;

    select unit_price, coalesce(descuento_porcentaje, 0), precio_lista
      into v_unit_price, v_descuento, v_lista
    from public.products where id = v_product_id;
    if not found then
      raise exception 'Producto no encontrado';
    end if;

    if v_tipo = 'promocion' and v_lista is not null then
      v_precio := round(coalesce(v_unit_price, 0), 2);
    elsif v_tipo = 'promocion' then
      v_precio := round(coalesce(v_unit_price, 0) * (1 - coalesce(v_descuento, 0) / 100), 2);
    else
      v_precio := round(coalesce(v_lista, v_unit_price, 0), 2);
    end if;

    insert into public.cotizacion_items (cotizacion_id, product_id, quantity, unit_price, tipo_precio)
    values (v_id, v_product_id, v_quantity, v_precio, v_tipo);

    v_total := v_total + v_quantity * v_precio;
  end loop;

  update public.cotizaciones set total = v_total where id = v_id;
  return v_folio;
end;
$$;

grant execute on function public.crear_cotizacion(text, text, text, integer, text, jsonb) to authenticated;

create or replace function public.marcar_cotizacion_convertida(p_cotizacion_id uuid, p_sale_folio text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('gerencia', 'ventas') then
    raise exception 'No tienes permiso para convertir cotizaciones';
  end if;
  update public.cotizaciones
  set status = 'convertida', sale_folio = p_sale_folio, cerrada_at = now()
  where id = p_cotizacion_id and status = 'abierta';
  if not found then
    raise exception 'Cotización no encontrada o ya cerrada';
  end if;
end;
$$;

grant execute on function public.marcar_cotizacion_convertida(uuid, text) to authenticated;

create or replace function public.cancelar_cotizacion(p_cotizacion_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('gerencia', 'ventas') then
    raise exception 'No tienes permiso para cancelar cotizaciones';
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'Escribe el motivo';
  end if;
  update public.cotizaciones
  set status = 'cancelada', motivo_cancelacion = trim(p_motivo), cerrada_at = now()
  where id = p_cotizacion_id and status = 'abierta';
  if not found then
    raise exception 'Cotización no encontrada o ya cerrada';
  end if;
end;
$$;

grant execute on function public.cancelar_cotizacion(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- Fin de la migración de la Etapa 4
-- ============================================================
