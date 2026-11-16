-- =====================================================================
-- LorpenaPa · Esquema inicial
-- SaaS para pequeños comercios: catálogo, tallas, stock y "resérvalo y
-- recógelo en tienda".
--
-- Principios:
--   · Todas las tablas llevan shop_id y RLS: cada tienda solo ve lo suyo.
--   · El público ve productos de tiendas publicadas y CUÁNTAS unidades hay
--     disponibles, nunca el stock exacto ni las reservas de otros.
--   · Disponible = stock − reservas activas. Reservar y entregar se hace
--     con funciones atómicas que bloquean la fila (sin ventas dobles).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.rol_miembro as enum ('owner', 'staff');

-- pending: recién hecha por el cliente · confirmed: la tienda la ha visto
-- collected: entregada (descuenta stock) · cancelled: anulada
create type public.estado_reserva as enum ('pending', 'confirmed', 'collected', 'cancelled');

create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tiendas
-- ---------------------------------------------------------------------
create table public.shops (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique
                    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name              text not null check (char_length(name) between 1 and 120),
  -- WhatsApp de la tienda, solo dígitos y "+" opcional (p. ej. +34600111222)
  whatsapp          text check (whatsapp is null or whatsapp ~ '^\+?[0-9]{9,15}$'),
  address           text check (address is null or char_length(address) <= 200),
  opening_hours     text check (opening_hours is null or char_length(opening_hours) <= 300),
  -- Cuánto tiempo se guarda una reserva antes de liberar la unidad
  reservation_hours integer not null default 48 check (reservation_hours between 1 and 168),
  is_published      boolean not null default false,
  created_by        uuid not null default auth.uid() references auth.users (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger shops_updated_at
  before update on public.shops
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------
-- Miembros
-- ---------------------------------------------------------------------
create table public.members (
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.rol_miembro not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create index members_user_idx on public.members (user_id);

create or replace function public.es_miembro(tienda uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.shop_id = tienda and m.user_id = auth.uid()
  );
$$;

create or replace function public.es_propietario(tienda uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.shop_id = tienda and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.esta_publicada(tienda uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.shops s where s.id = tienda and s.is_published);
$$;

create or replace function public.alta_propietario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.members (shop_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger shops_alta_propietario
  after insert on public.shops
  for each row execute function public.alta_propietario();

-- ---------------------------------------------------------------------
-- Categorías y marcas (nombres únicos por tienda, sin distinguir mayúsculas)
-- ---------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);
create unique index categories_nombre_unico on public.categories (shop_id, lower(name));

create table public.brands (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);
create unique index brands_nombre_unico on public.brands (shop_id, lower(name));

-- ---------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops (id) on delete cascade,
  category_id      uuid,
  brand_id         uuid,
  name             text not null check (char_length(name) between 1 and 160),
  description      text check (description is null or char_length(description) <= 2000),
  price_cents      integer not null check (price_cents between 0 and 10000000),
  -- Precio de oferta: siempre por debajo del normal
  sale_price_cents integer check (sale_price_cents is null or sale_price_cents >= 0),
  is_new           boolean not null default false,
  is_active        boolean not null default true,
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, shop_id),
  foreign key (category_id, shop_id)
    references public.categories (id, shop_id) on delete set null (category_id),
  foreign key (brand_id, shop_id)
    references public.brands (id, shop_id) on delete set null (brand_id),
  constraint oferta_menor_que_precio check (sale_price_cents is null or sale_price_cents < price_cents)
);

create index products_shop_idx on public.products (shop_id, category_id, position);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------
-- Variantes (talla / color) con su stock
-- ---------------------------------------------------------------------
create table public.variants (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null,
  product_id uuid not null,
  size       text not null default 'Única' check (char_length(size) between 1 and 20),
  color      text check (color is null or char_length(color) between 1 and 40),
  sku        text check (sku is null or char_length(sku) <= 60),
  stock      integer not null default 0 check (stock between 0 and 100000),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, shop_id),
  foreign key (product_id, shop_id)
    references public.products (id, shop_id) on delete cascade
);
create unique index variants_unica
  on public.variants (product_id, lower(size), lower(coalesce(color, '')));
create index variants_shop_idx on public.variants (shop_id, product_id);

create trigger variants_updated_at
  before update on public.variants
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------
create table public.reservations (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null,
  variant_id     uuid not null,
  code           text not null check (code ~ '^[A-Z2-9]{6}$'),
  customer_name  text not null check (char_length(customer_name) between 2 and 80),
  customer_phone text not null check (customer_phone ~ '^\+?[0-9]{9,15}$'),
  quantity       integer not null default 1 check (quantity between 1 and 5),
  status         public.estado_reserva not null default 'pending',
  expires_at     timestamptz not null,
  -- Momento en que el cliente aceptó el tratamiento de sus datos
  consent_at     timestamptz not null,
  closed_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (shop_id, code),
  foreign key (variant_id, shop_id)
    references public.variants (id, shop_id) on delete cascade,
  constraint caduca_despues check (expires_at > created_at)
);

create index reservations_variante_activas
  on public.reservations (variant_id) where status in ('pending', 'confirmed');
create index reservations_telefono on public.reservations (shop_id, customer_phone);
create index reservations_shop_fecha on public.reservations (shop_id, created_at desc);

-- Reglas de cambio de estado:
--   · "collected" solo se puede poner desde marcar_recogida() (descuenta stock)
--   · una reserva cerrada (recogida o cancelada) ya no cambia
--   · no se puede cambiar qué, cuánto ni de quién era la reserva
create or replace function public.proteger_reserva()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('pending', 'confirmed') then
      raise exception 'Una reserva nueva debe estar pendiente o confirmada' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status in ('collected', 'cancelled') and new.status is distinct from old.status then
    raise exception 'Esta reserva ya está cerrada' using errcode = '42501', hint = 'cerrada';
  end if;
  if new.status = 'collected' and old.status <> 'collected'
     and coalesce(current_setting('lorpenapa.recogida', true), '') <> 'on' then
    raise exception 'Para entregar una reserva usa marcar_recogida()' using errcode = '42501';
  end if;
  if new.variant_id is distinct from old.variant_id or new.quantity is distinct from old.quantity
     or new.shop_id is distinct from old.shop_id or new.code is distinct from old.code
     or new.customer_phone is distinct from old.customer_phone then
    raise exception 'No se pueden cambiar los datos de una reserva' using errcode = '42501';
  end if;

  if new.status in ('collected', 'cancelled') and new.closed_at is null then
    new.closed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger reservations_proteger
  before insert or update on public.reservations
  for each row execute function public.proteger_reserva();

-- =====================================================================
-- Funciones públicas
-- =====================================================================

-- Unidades disponibles por variante de una tienda publicada.
-- (stock − reservas activas no caducadas; nunca negativo)
create or replace function public.disponibilidad(p_tienda uuid)
returns table (variant_id uuid, disponible integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id,
         greatest(
           v.stock - coalesce(sum(r.quantity) filter (
             where r.status in ('pending', 'confirmed') and r.expires_at > now()
           ), 0),
           0
         )::integer
  from public.variants v
  join public.products p on p.id = v.product_id and p.is_active
  join public.shops s on s.id = v.shop_id and s.is_published
  left join public.reservations r on r.variant_id = v.id
  where v.shop_id = p_tienda
  group by v.id, v.stock;
$$;

-- Código de reserva legible: 6 caracteres sin 0/O ni 1/I para no confundirse
create or replace function public.generar_codigo()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codigo text := '';
begin
  for i in 1..6 loop
    codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::integer, 1);
  end loop;
  return codigo;
end;
$$;

-- Reserva pública ("resérvalo y recógelo"), atómica:
-- bloquea la variante mientras comprueba el disponible, así dos clientes
-- no pueden llevarse la misma última unidad.
-- Los errores llevan un "hint" estable para que la app muestre el mensaje.
create or replace function public.crear_reserva(
  p_variante       uuid,
  p_nombre         text,
  p_telefono       text,
  p_cantidad       integer,
  p_consentimiento boolean
)
returns table (codigo text, caduca timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_telefono  text := regexp_replace(coalesce(p_telefono, ''), '[[:space:]().-]', '', 'g');
  v_nombre    text := btrim(coalesce(p_nombre, ''));
  v_tienda    uuid;
  v_stock     integer;
  v_horas     integer;
  v_reservado integer;
  v_activas   integer;
  v_codigo    text;
  v_caduca    timestamptz;
begin
  if p_consentimiento is not true then
    raise exception 'Debes aceptar el tratamiento de tus datos para reservar' using hint = 'consentimiento';
  end if;
  if char_length(v_nombre) not between 2 and 80 then
    raise exception 'Escribe tu nombre' using hint = 'nombre';
  end if;
  if v_telefono !~ '^\+?[0-9]{9,15}$' then
    raise exception 'El teléfono no es válido' using hint = 'telefono';
  end if;
  if p_cantidad is null or p_cantidad not between 1 and 5 then
    raise exception 'Puedes reservar entre 1 y 5 unidades' using hint = 'cantidad';
  end if;

  -- Bloqueo de la variante: las reservas simultáneas de la misma talla esperan su turno
  select v.shop_id, v.stock, s.reservation_hours
    into v_tienda, v_stock, v_horas
  from public.variants v
  join public.products p on p.id = v.product_id and p.is_active
  join public.shops s on s.id = v.shop_id and s.is_published
  where v.id = p_variante
  for update of v;

  if not found then
    raise exception 'Este producto ya no está disponible' using hint = 'no_disponible';
  end if;

  select count(*) into v_activas
  from public.reservations r
  where r.shop_id = v_tienda and r.customer_phone = v_telefono
    and r.status in ('pending', 'confirmed') and r.expires_at > now();
  if v_activas >= 3 then
    raise exception 'Ya tienes 3 reservas activas en esta tienda' using hint = 'limite';
  end if;

  select coalesce(sum(r.quantity), 0) into v_reservado
  from public.reservations r
  where r.variant_id = p_variante
    and r.status in ('pending', 'confirmed') and r.expires_at > now();
  if v_stock - v_reservado < p_cantidad then
    raise exception 'No quedan unidades suficientes de esta talla' using hint = 'sin_stock';
  end if;

  v_caduca := now() + make_interval(hours => v_horas);
  loop
    v_codigo := public.generar_codigo();
    begin
      insert into public.reservations
        (shop_id, variant_id, code, customer_name, customer_phone, quantity, status, expires_at, consent_at)
      values
        (v_tienda, p_variante, v_codigo, v_nombre, v_telefono, p_cantidad, 'pending', v_caduca, now());
      exit;
    exception when unique_violation then
      -- Código repetido en esta tienda (muy improbable): se genera otro
    end;
  end loop;

  return query select v_codigo, v_caduca;
end;
$$;

-- Entrega en tienda, atómica: descuenta el stock y cierra la reserva.
-- SECURITY INVOKER: solo funciona para miembros de la tienda (RLS).
create or replace function public.marcar_recogida(p_reserva uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.reservations%rowtype;
begin
  select * into r from public.reservations where id = p_reserva for update;
  if not found or not public.es_miembro(r.shop_id) then
    raise exception 'Reserva no encontrada' using errcode = '42501';
  end if;
  if r.status not in ('pending', 'confirmed') then
    raise exception 'Esta reserva ya está cerrada' using hint = 'cerrada';
  end if;

  update public.variants
     set stock = stock - r.quantity
   where id = r.variant_id and stock >= r.quantity;
  if not found then
    raise exception 'No hay stock suficiente para entregar esta reserva' using hint = 'sin_stock';
  end if;

  perform set_config('lorpenapa.recogida', 'on', true);
  update public.reservations set status = 'collected' where id = p_reserva;
  perform set_config('lorpenapa.recogida', 'off', true);
end;
$$;

-- Protección de datos: borra las reservas cerradas o caducadas hace más de
-- 30 días. La ejecuta pg_cron cada noche (ver migración solo-supabase).
create or replace function public.purgar_reservas(p_dias integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  borradas integer;
begin
  delete from public.reservations
  where (status in ('collected', 'cancelled') and closed_at < now() - make_interval(days => p_dias))
     or (status in ('pending', 'confirmed') and expires_at < now() - make_interval(days => p_dias));
  get diagnostics borradas = row_count;
  return borradas;
end;
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.shops        enable row level security;
alter table public.members      enable row level security;
alter table public.categories   enable row level security;
alter table public.brands       enable row level security;
alter table public.products     enable row level security;
alter table public.variants     enable row level security;
alter table public.reservations enable row level security;

-- ---- shops ----------------------------------------------------------
create policy "publico ve tiendas publicadas"
  on public.shops for select to anon, authenticated using (is_published);
create policy "miembros ven su tienda"
  on public.shops for select to authenticated using (public.es_miembro(id));
-- Para insert ... returning (el alta de propietario va en un trigger AFTER)
create policy "creador ve su tienda"
  on public.shops for select to authenticated using (created_by = auth.uid());
create policy "usuario crea tienda propia"
  on public.shops for insert to authenticated with check (created_by = auth.uid());
create policy "propietario edita tienda"
  on public.shops for update to authenticated
  using (public.es_propietario(id)) with check (public.es_propietario(id));
create policy "propietario borra tienda"
  on public.shops for delete to authenticated using (public.es_propietario(id));

-- ---- members --------------------------------------------------------
create policy "miembros ven al equipo"
  on public.members for select to authenticated using (public.es_miembro(shop_id));
create policy "propietario da de alta"
  on public.members for insert to authenticated with check (public.es_propietario(shop_id));
create policy "propietario cambia roles"
  on public.members for update to authenticated
  using (public.es_propietario(shop_id)) with check (public.es_propietario(shop_id));
create policy "propietario da de baja"
  on public.members for delete to authenticated using (public.es_propietario(shop_id));

-- ---- catálogo: público lee si la tienda está publicada ---------------
create policy "publico lee categorias"
  on public.categories for select to anon, authenticated using (public.esta_publicada(shop_id));
create policy "miembros gestionan categorias"
  on public.categories for all to authenticated
  using (public.es_miembro(shop_id)) with check (public.es_miembro(shop_id));

create policy "publico lee marcas"
  on public.brands for select to anon, authenticated using (public.esta_publicada(shop_id));
create policy "miembros gestionan marcas"
  on public.brands for all to authenticated
  using (public.es_miembro(shop_id)) with check (public.es_miembro(shop_id));

create policy "publico lee productos activos"
  on public.products for select to anon, authenticated
  using (public.esta_publicada(shop_id) and is_active);
create policy "miembros gestionan productos"
  on public.products for all to authenticated
  using (public.es_miembro(shop_id)) with check (public.es_miembro(shop_id));

-- Variantes: solo el público anónimo (la web) y sin la columna stock
-- (ver permisos de columna más abajo). Otros comercios con sesión no ven
-- las variantes ajenas.
create policy "publico lee variantes"
  on public.variants for select to anon
  using (
    public.esta_publicada(shop_id)
    and exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );
create policy "miembros gestionan variantes"
  on public.variants for all to authenticated
  using (public.es_miembro(shop_id)) with check (public.es_miembro(shop_id));

-- ---- reservations: solo la tienda -----------------------------------
-- El público reserva a través de crear_reserva(), nunca escribiendo aquí.
create policy "miembros ven reservas"
  on public.reservations for select to authenticated using (public.es_miembro(shop_id));
create policy "miembros anotan reservas"
  on public.reservations for insert to authenticated with check (public.es_miembro(shop_id));
create policy "miembros actualizan reservas"
  on public.reservations for update to authenticated
  using (public.es_miembro(shop_id)) with check (public.es_miembro(shop_id));
create policy "miembros borran reservas"
  on public.reservations for delete to authenticated using (public.es_miembro(shop_id));

-- =====================================================================
-- Permisos
-- =====================================================================
grant usage on schema public to anon, authenticated;

grant select on public.shops, public.categories, public.brands, public.products to anon;
-- Al público NO se le da la columna stock: solo ve cuántas quedan vía disponibilidad()
grant select (id, shop_id, product_id, size, color, position) on public.variants to anon;

grant select, insert, update, delete on
  public.shops, public.members, public.categories, public.brands,
  public.products, public.variants, public.reservations
  to authenticated;

revoke execute on function
  public.es_miembro(uuid), public.es_propietario(uuid), public.esta_publicada(uuid),
  public.alta_propietario(), public.disponibilidad(uuid), public.generar_codigo(),
  public.crear_reserva(uuid, text, text, integer, boolean), public.marcar_recogida(uuid),
  public.purgar_reservas(integer), public.proteger_reserva()
  from public;

grant execute on function public.esta_publicada(uuid) to anon, authenticated;
grant execute on function public.disponibilidad(uuid) to anon, authenticated;
grant execute on function public.crear_reserva(uuid, text, text, integer, boolean) to anon, authenticated;
grant execute on function public.es_miembro(uuid), public.es_propietario(uuid) to authenticated;
grant execute on function public.marcar_recogida(uuid) to authenticated;
-- purgar_reservas: solo el propio sistema (pg_cron), nadie desde la API
