import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { clientePublico } from "@/lib/supabase/publico";
import { etiquetaTienda, montarCatalogoPublico, type CatalogoPublico } from "@/lib/domain/catalogoPublico";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Catálogo público de una tienda, cacheado.
 * - Se renueva al momento con updateTag(etiquetaTienda(slug)) desde el panel
 *   y tras cada reserva.
 * - Además caduca a los pocos minutos ("minutes"), para que las reservas que
 *   caducan solas liberen la talla en pantalla sin que nadie toque nada.
 * - Devuelve null si la tienda no existe o no está publicada (RLS).
 */
export async function cargarCatalogoPublico(slug: string): Promise<CatalogoPublico | null> {
  "use cache";
  cacheTag(etiquetaTienda(slug));
  cacheLife("minutes");

  if (!SLUG.test(slug) || slug.length > 60) return null;
  const supabase = clientePublico();

  const { data: tienda, error } = await supabase
    .from("shops")
    .select("id, name, slug, whatsapp, address, opening_hours, reservation_hours")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la tienda: ${error.message}`);
  if (!tienda) return null;

  const [cats, marcas, productos, variantes, disponibilidad] = await Promise.all([
    supabase.from("categories").select("id, name, position").eq("shop_id", tienda.id),
    supabase.from("brands").select("id, name").eq("shop_id", tienda.id),
    supabase
      .from("products")
      .select("id, name, description, category_id, brand_id, price_cents, sale_price_cents, is_new, position")
      .eq("shop_id", tienda.id),
    // Sin la columna stock: el público no tiene permiso para leerla
    supabase.from("variants").select("id, product_id, size, color, position").eq("shop_id", tienda.id),
    supabase.rpc("disponibilidad", { p_tienda: tienda.id }),
  ]);
  const e = cats.error ?? marcas.error ?? productos.error ?? variantes.error ?? disponibilidad.error;
  if (e) throw new Error(`No se pudo leer el catálogo: ${e.message}`);

  return montarCatalogoPublico(
    tienda,
    cats.data ?? [],
    marcas.data ?? [],
    productos.data ?? [],
    variantes.data ?? [],
    disponibilidad.data ?? [],
  );
}
