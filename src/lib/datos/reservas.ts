import "server-only";
import type { EstadoReserva } from "@/lib/supabase/tipos";
import type { ContextoTienda } from "./sesion";

export type ReservaPanel = {
  id: string;
  codigo: string;
  cliente: string;
  telefono: string;
  cantidad: number;
  estado: EstadoReserva;
  /** pendiente/confirmada cuya fecha de caducidad ya pasó */
  caducada: boolean;
  caduca: string;
  creada: string;
  cerrada: string | null;
  producto: string;
  productoId: string | null;
  talla: string;
  color: string | null;
};

/**
 * Reservas de la tienda (activas y cerradas recientes) con el producto y la
 * talla. Las cerradas se borran solas a los 30 días (protección de datos).
 */
export async function cargarReservas(ctx: ContextoTienda): Promise<ReservaPanel[]> {
  const { data: reservas, error } = await ctx.supabase
    .from("reservations")
    .select("*")
    .eq("shop_id", ctx.tienda.id)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`No se pudieron cargar las reservas: ${error.message}`);
  if (!reservas?.length) return [];

  const idsVariantes = [...new Set(reservas.map((r) => r.variant_id))];
  const { data: variantes, error: e2 } = await ctx.supabase
    .from("variants")
    .select("id, product_id, size, color")
    .eq("shop_id", ctx.tienda.id)
    .in("id", idsVariantes);
  if (e2) throw new Error(`No se pudieron cargar las tallas: ${e2.message}`);

  const idsProductos = [...new Set((variantes ?? []).map((v) => v.product_id))];
  const { data: productos, error: e3 } = idsProductos.length
    ? await ctx.supabase.from("products").select("id, name").eq("shop_id", ctx.tienda.id).in("id", idsProductos)
    : { data: [], error: null };
  if (e3) throw new Error(`No se pudieron cargar los productos: ${e3.message}`);

  const variante = new Map((variantes ?? []).map((v) => [v.id, v]));
  const producto = new Map((productos ?? []).map((p) => [p.id, p.name]));
  const ahora = Date.now();

  return reservas.map((r) => {
    const v = variante.get(r.variant_id);
    const activa = r.status === "pending" || r.status === "confirmed";
    return {
      id: r.id,
      codigo: r.code,
      cliente: r.customer_name,
      telefono: r.customer_phone,
      cantidad: r.quantity,
      estado: r.status,
      caducada: activa && new Date(r.expires_at).getTime() <= ahora,
      caduca: r.expires_at,
      creada: r.created_at,
      cerrada: r.closed_at,
      producto: v ? (producto.get(v.product_id) ?? "Producto borrado") : "Producto borrado",
      productoId: v?.product_id ?? null,
      talla: v?.size ?? "—",
      color: v?.color ?? null,
    };
  });
}

/** Reservas pendientes de atender (para el contador de la pestaña). */
export async function contarPendientes(ctx: ContextoTienda): Promise<number> {
  const { count, error } = await ctx.supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", ctx.tienda.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());
  if (error) return 0;
  return count ?? 0;
}
