-- =====================================================================
-- LorpenaPa · Proteger las reservas activas y ajustar stock de forma atómica
--
-- 1. No se puede borrar una talla (ni el producto que la contiene) si tiene
--    reservas activas: antes se borraban en cascada sin avisar.
-- 2. ajustar_stock(): suma o resta unidades sin carreras (botones +1 / −1).
-- =====================================================================

create or replace function public.impedir_borrar_con_reservas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.reservations r
    where r.variant_id = old.id
      and r.status in ('pending', 'confirmed')
      and r.expires_at > now()
  ) then
    raise exception 'La talla % tiene reservas activas: entrégalas o cancélalas antes de borrarla', old.size
      using hint = 'reservas_activas';
  end if;
  return old;
end;
$$;

-- Se dispara también al borrar el producto (el borrado en cascada pasa por aquí)
create trigger variants_impedir_borrar_con_reservas
  before delete on public.variants
  for each row execute function public.impedir_borrar_con_reservas();

-- Ajuste atómico de stock. SECURITY INVOKER: solo miembros de la tienda (RLS).
-- Devuelve el stock resultante; nunca baja de 0.
create or replace function public.ajustar_stock(p_variante uuid, p_delta integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stock integer;
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 1000 then
    raise exception 'Ajuste de stock no válido' using hint = 'delta';
  end if;

  update public.variants
     set stock = stock + p_delta
   where id = p_variante and stock + p_delta >= 0
  returning stock into v_stock;

  if not found then
    if exists (select 1 from public.variants where id = p_variante) then
      raise exception 'El stock no puede quedar por debajo de 0' using hint = 'negativo';
    end if;
    raise exception 'Talla no encontrada' using errcode = '42501';
  end if;
  return v_stock;
end;
$$;

revoke execute on function public.impedir_borrar_con_reservas(), public.ajustar_stock(uuid, integer) from public;
grant execute on function public.ajustar_stock(uuid, integer) to authenticated;
