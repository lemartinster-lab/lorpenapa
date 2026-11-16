import "server-only";
import type { FilaCategoria, FilaMarca, FilaProducto, FilaVariante } from "@/lib/supabase/tipos";
import type { ContextoTienda } from "./sesion";

export const POCAS_UNIDADES = 2;

export async function cargarCatalogo(ctx: ContextoTienda): Promise<{ categorias: FilaCategoria[]; marcas: FilaMarca[] }> {
  const [cats, marcas] = await Promise.all([
    ctx.supabase
      .from("categories")
      .select("*")
      .eq("shop_id", ctx.tienda.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    ctx.supabase.from("brands").select("*").eq("shop_id", ctx.tienda.id).order("name", { ascending: true }),
  ]);
  const error = cats.error ?? marcas.error;
  if (error) throw new Error(`No se pudo cargar el catálogo: ${error.message}`);
  return { categorias: cats.data ?? [], marcas: marcas.data ?? [] };
}

export type ResumenProducto = FilaProducto & {
  tallas: number;
  stockTotal: number;
  tallasAgotadas: number;
};

/** Lista de productos con su resumen de stock (para la pantalla de productos). */
export async function cargarProductos(ctx: ContextoTienda): Promise<ResumenProducto[]> {
  const [productos, variantes] = await Promise.all([
    ctx.supabase
      .from("products")
      .select("*")
      .eq("shop_id", ctx.tienda.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false }),
    ctx.supabase.from("variants").select("product_id, stock").eq("shop_id", ctx.tienda.id),
  ]);
  const error = productos.error ?? variantes.error;
  if (error) throw new Error(`No se pudieron cargar los productos: ${error.message}`);

  const porProducto = new Map<string, { tallas: number; stock: number; agotadas: number }>();
  for (const v of variantes.data ?? []) {
    const r = porProducto.get(v.product_id) ?? { tallas: 0, stock: 0, agotadas: 0 };
    r.tallas += 1;
    r.stock += v.stock;
    if (v.stock === 0) r.agotadas += 1;
    porProducto.set(v.product_id, r);
  }

  return (productos.data ?? []).map((p) => {
    const r = porProducto.get(p.id) ?? { tallas: 0, stock: 0, agotadas: 0 };
    return { ...p, tallas: r.tallas, stockTotal: r.stock, tallasAgotadas: r.agotadas };
  });
}

export type VarianteConReservas = FilaVariante & { reservadas: number };

/** Ficha de producto con sus tallas y las unidades reservadas de cada una. */
export async function cargarProducto(
  ctx: ContextoTienda,
  id: string,
): Promise<{ producto: FilaProducto; variantes: VarianteConReservas[] } | null> {
  const { data: producto, error } = await ctx.supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("shop_id", ctx.tienda.id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar el producto: ${error.message}`);
  if (!producto) return null;

  const [variantes, reservas] = await Promise.all([
    ctx.supabase
      .from("variants")
      .select("*")
      .eq("product_id", id)
      .eq("shop_id", ctx.tienda.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    ctx.supabase
      .from("reservations")
      .select("variant_id, quantity")
      .eq("shop_id", ctx.tienda.id)
      .in("status", ["pending", "confirmed"])
      .gt("expires_at", new Date().toISOString()),
  ]);
  const e2 = variantes.error ?? reservas.error;
  if (e2) throw new Error(`No se pudieron cargar las tallas: ${e2.message}`);

  const reservadas = new Map<string, number>();
  for (const r of reservas.data ?? []) reservadas.set(r.variant_id, (reservadas.get(r.variant_id) ?? 0) + r.quantity);

  return {
    producto,
    variantes: (variantes.data ?? []).map((v) => ({ ...v, reservadas: reservadas.get(v.id) ?? 0 })),
  };
}
