/**
 * Catálogo público: cómo se monta a partir de las filas de la BD y cómo se
 * filtra. Lógica pura (sin Supabase ni Next.js) para poder probarla.
 *
 * Privacidad: el número exacto de unidades NUNCA sale de aquí. Cada talla
 * llega al navegador solo como "disponible", "ultimas" o "agotada".
 */
import { porcentajeDescuento } from "./precio";

export const UMBRAL_ULTIMAS = 2;

export type EstadoTalla = "disponible" | "ultimas" | "agotada";

export type TallaPublica = { id: string; talla: string; color: string | null; estado: EstadoTalla };

export type ProductoPublico = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: string | null;
  marca: string | null;
  marcaId: string | null;
  precioCentimos: number;
  ofertaCentimos: number | null;
  descuento: number | null;
  nuevo: boolean;
  tallas: TallaPublica[];
};

export type CatalogoPublico = {
  tienda: {
    id: string;
    nombre: string;
    slug: string;
    whatsapp: string | null;
    direccion: string | null;
    horario: string | null;
    horasReserva: number;
  };
  categorias: { id: string; nombre: string }[];
  marcas: { id: string; nombre: string }[];
  /** Todas las tallas que existen en la tienda, en orden lógico (para el filtro) */
  tallas: string[];
  productos: ProductoPublico[];
};

type FilaTienda = {
  id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  address: string | null;
  opening_hours: string | null;
  reservation_hours: number;
};
type FilaCategoria = { id: string; name: string; position: number };
type FilaMarca = { id: string; name: string };
type FilaProducto = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  brand_id: string | null;
  price_cents: number;
  sale_price_cents: number | null;
  is_new: boolean;
  position: number;
};
type FilaVariante = { id: string; product_id: string; size: string; color: string | null; position: number };
type FilaDisponible = { variant_id: string; disponible: number };

// ---------------------------------------------------------------------
// Orden de tallas: números de menor a mayor, luego ropa (XS…XXXL), luego el resto
// ---------------------------------------------------------------------
const ORDEN_ROPA = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL"];

function claveTalla(t: string): [number, number, string] {
  const num = Number(t.replace(",", "."));
  if (!Number.isNaN(num) && /^\d/.test(t)) return [0, num, ""];
  const i = ORDEN_ROPA.indexOf(t.toUpperCase());
  if (i >= 0) return [1, i, ""];
  return [2, 0, t.toLowerCase()];
}

export function compararTallas(a: string, b: string): number {
  const [ga, na, sa] = claveTalla(a);
  const [gb, nb, sb] = claveTalla(b);
  return ga - gb || na - nb || sa.localeCompare(sb, "es");
}

export function estadoTalla(disponible: number): EstadoTalla {
  if (disponible <= 0) return "agotada";
  if (disponible <= UMBRAL_ULTIMAS) return "ultimas";
  return "disponible";
}

export function montarCatalogoPublico(
  tienda: FilaTienda,
  categorias: FilaCategoria[],
  marcas: FilaMarca[],
  productos: FilaProducto[],
  variantes: FilaVariante[],
  disponibilidad: FilaDisponible[],
): CatalogoPublico {
  const disponible = new Map(disponibilidad.map((d) => [d.variant_id, d.disponible]));
  const nombreMarca = new Map(marcas.map((m) => [m.id, m.name]));

  const tallasDe = new Map<string, TallaPublica[]>();
  for (const v of [...variantes].sort((a, b) => a.position - b.position)) {
    const lista = tallasDe.get(v.product_id) ?? [];
    // Sin dato de disponibilidad = no se puede reservar (agotada)
    lista.push({ id: v.id, talla: v.size, color: v.color, estado: estadoTalla(disponible.get(v.id) ?? 0) });
    tallasDe.set(v.product_id, lista);
  }

  const lista: ProductoPublico[] = [...productos]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({
      id: p.id,
      nombre: p.name,
      descripcion: p.description,
      categoriaId: p.category_id,
      marca: p.brand_id ? (nombreMarca.get(p.brand_id) ?? null) : null,
      marcaId: p.brand_id,
      precioCentimos: p.price_cents,
      ofertaCentimos: p.sale_price_cents,
      descuento: porcentajeDescuento(p.price_cents, p.sale_price_cents),
      nuevo: p.is_new,
      tallas: tallasDe.get(p.id) ?? [],
    }))
    // Un producto sin tallas no se puede reservar: no se muestra
    .filter((p) => p.tallas.length > 0);

  const usadas = (campo: "categoriaId" | "marcaId") => new Set(lista.map((p) => p[campo]).filter(Boolean));
  const catsUsadas = usadas("categoriaId");
  const marcasUsadas = usadas("marcaId");

  const tallasUnicas = new Map<string, string>();
  for (const p of lista) for (const t of p.tallas) tallasUnicas.set(t.talla.toLowerCase(), t.talla);

  return {
    tienda: {
      id: tienda.id,
      nombre: tienda.name,
      slug: tienda.slug,
      whatsapp: tienda.whatsapp,
      direccion: tienda.address,
      horario: tienda.opening_hours,
      horasReserva: tienda.reservation_hours,
    },
    // Solo categorías y marcas con algún producto visible
    categorias: [...categorias]
      .sort((a, b) => a.position - b.position)
      .filter((c) => catsUsadas.has(c.id))
      .map((c) => ({ id: c.id, nombre: c.name })),
    marcas: [...marcas]
      .filter((m) => marcasUsadas.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((m) => ({ id: m.id, nombre: m.name })),
    tallas: [...tallasUnicas.values()].sort(compararTallas),
    productos: lista,
  };
}

// ---------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------
export type Filtros = { categoria?: string; marca?: string; talla?: string; soloOfertas?: boolean };

export function filtrarProductos(productos: readonly ProductoPublico[], f: Filtros): ProductoPublico[] {
  const talla = f.talla?.toLowerCase();
  return productos.filter(
    (p) =>
      (!f.categoria || p.categoriaId === f.categoria) &&
      (!f.marca || p.marcaId === f.marca) &&
      (!f.soloOfertas || p.descuento !== null) &&
      // "Mi talla": el producto la tiene y se puede reservar ahora
      (!talla || p.tallas.some((t) => t.talla.toLowerCase() === talla && t.estado !== "agotada")),
  );
}

export const hayDisponible = (p: ProductoPublico) => p.tallas.some((t) => t.estado !== "agotada");

/** Etiqueta de caché del catálogo de una tienda (para renovarlo al editar o reservar). */
export const etiquetaTienda = (slug: string) => `tienda:${slug}`;
