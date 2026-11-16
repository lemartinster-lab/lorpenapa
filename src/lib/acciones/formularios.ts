/**
 * Conversión de formularios (FormData) a datos validados.
 * Lógica pura, sin Supabase ni Next.js, para poder probarla con tests.
 */
import { z } from "zod";
import { parsearPrecio } from "@/lib/domain/precio";
import { generarSlug } from "@/lib/domain/slug";

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

const texto = (fd: FormData, campo: string): string => {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
};

export const idSchema = z.uuid();
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------
// Teléfono (WhatsApp): mismo formato que exige la base de datos
// ---------------------------------------------------------------------
/** "+34 600 11 22 33" → "+34600112233"; "600112233" → "+34600112233". */
export function normalizarTelefono(valor: string): string | null {
  const limpio = valor.replace(/[\s().-]/g, "");
  if (!limpio) return null;
  // Un móvil o fijo español de 9 cifras sin prefijo → +34
  const conPrefijo = /^[6789]\d{8}$/.test(limpio) ? `+34${limpio}` : limpio;
  return /^\+?[0-9]{9,15}$/.test(conPrefijo) ? conPrefijo : null;
}

// ---------------------------------------------------------------------
// Tienda
// ---------------------------------------------------------------------
export function leerNuevaTienda(fd: FormData): Resultado<{ name: string; slug: string; whatsapp: string | null }> {
  const name = texto(fd, "nombre");
  if (!name) return { ok: false, error: "Escribe el nombre de la tienda." };
  if (name.length > 120) return { ok: false, error: "El nombre es demasiado largo (máximo 120 caracteres)." };

  const slug = generarSlug(texto(fd, "slug") || name);
  if (slug.length < 3 || slug.length > 60 || !SLUG.test(slug)) {
    return {
      ok: false,
      error: "La dirección web debe tener entre 3 y 60 caracteres: letras sin tildes, números y guiones.",
    };
  }

  const telefono = texto(fd, "whatsapp");
  const whatsapp = telefono ? normalizarTelefono(telefono) : null;
  if (telefono && !whatsapp) return { ok: false, error: "El WhatsApp no es válido. Ejemplo: 600 11 22 33." };

  return { ok: true, datos: { name, slug, whatsapp } };
}

export type DatosTienda = {
  name: string;
  whatsapp: string | null;
  address: string | null;
  opening_hours: string | null;
  reservation_hours: number;
};

export function leerDatosTienda(fd: FormData): Resultado<DatosTienda> {
  const name = texto(fd, "nombre");
  if (!name || name.length > 120) return { ok: false, error: "Escribe el nombre de la tienda (máximo 120 caracteres)." };

  const telefono = texto(fd, "whatsapp");
  const whatsapp = telefono ? normalizarTelefono(telefono) : null;
  if (telefono && !whatsapp) return { ok: false, error: "El WhatsApp no es válido. Ejemplo: 600 11 22 33." };

  const address = texto(fd, "direccion") || null;
  if (address && address.length > 200) return { ok: false, error: "La dirección es demasiado larga (máximo 200)." };

  const opening_hours = texto(fd, "horario") || null;
  if (opening_hours && opening_hours.length > 300) return { ok: false, error: "El horario es demasiado largo (máximo 300)." };

  const horas = Number(texto(fd, "horas_reserva"));
  if (!Number.isInteger(horas) || horas < 1 || horas > 168) {
    return { ok: false, error: "Las reservas deben durar entre 1 y 168 horas (una semana)." };
  }

  return { ok: true, datos: { name, whatsapp, address, opening_hours, reservation_hours: horas } };
}

// ---------------------------------------------------------------------
// Categorías y marcas
// ---------------------------------------------------------------------
export function leerNombre(fd: FormData, que: "categoría" | "marca"): Resultado<{ name: string }> {
  const name = texto(fd, "nombre").replace(/\s+/g, " ");
  if (!name) return { ok: false, error: `Escribe el nombre de la ${que}.` };
  if (name.length > 80) return { ok: false, error: "Máximo 80 caracteres." };
  return { ok: true, datos: { name } };
}

/** "  Café  Ñoño " y "cafe ñoño" cuentan como el mismo nombre. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buscarDuplicado(
  existentes: readonly { id: string; name: string }[],
  nombre: string,
  excluirId?: string,
): string | null {
  const buscado = normalizarNombre(nombre);
  const encontrada = existentes.find((c) => c.id !== excluirId && normalizarNombre(c.name) === buscado);
  return encontrada ? encontrada.name : null;
}

// ---------------------------------------------------------------------
// Producto
// ---------------------------------------------------------------------
export type DatosProducto = {
  name: string;
  description: string | null;
  category_id: string | null;
  brand_id: string | null;
  price_cents: number;
  sale_price_cents: number | null;
  is_new: boolean;
  is_active: boolean;
};

const idOpcional = (fd: FormData, campo: string): string | null | "invalido" => {
  const v = texto(fd, campo);
  if (!v) return null;
  return idSchema.safeParse(v).success ? v : "invalido";
};

export function leerProducto(fd: FormData): Resultado<DatosProducto> {
  const name = texto(fd, "nombre");
  if (!name || name.length > 160) return { ok: false, error: "Escribe el nombre del producto (máximo 160 caracteres)." };

  const description = texto(fd, "descripcion") || null;
  if (description && description.length > 2000) return { ok: false, error: "La descripción es demasiado larga (máximo 2000)." };

  const precio = parsearPrecio(texto(fd, "precio"));
  if (precio === null) return { ok: false, error: "Escribe un precio válido, por ejemplo 65,00." };

  const textoOferta = texto(fd, "oferta");
  const oferta = textoOferta ? parsearPrecio(textoOferta) : null;
  if (textoOferta && oferta === null) return { ok: false, error: "El precio de oferta no es válido." };
  if (oferta !== null && oferta >= precio) {
    return { ok: false, error: "El precio de oferta tiene que ser menor que el precio normal." };
  }

  const category_id = idOpcional(fd, "categoria");
  const brand_id = idOpcional(fd, "marca");
  if (category_id === "invalido") return { ok: false, error: "La categoría elegida no es válida." };
  if (brand_id === "invalido") return { ok: false, error: "La marca elegida no es válida." };

  return {
    ok: true,
    datos: {
      name,
      description,
      category_id,
      brand_id,
      price_cents: precio,
      sale_price_cents: oferta,
      is_new: fd.get("nuevo") === "on",
      is_active: fd.get("activo") === "on",
    },
  };
}

// ---------------------------------------------------------------------
// Variante (una fila de la tabla de tallas)
// ---------------------------------------------------------------------
export type DatosVariante = { size: string; color: string | null; sku: string | null; stock: number };

export function leerVariante(fd: FormData): Resultado<DatosVariante> {
  const size = texto(fd, "talla");
  if (!size || size.length > 20) return { ok: false, error: "Escribe la talla (máximo 20 caracteres)." };

  const color = texto(fd, "color") || null;
  if (color && color.length > 40) return { ok: false, error: "El color es demasiado largo (máximo 40)." };

  const sku = texto(fd, "referencia") || null;
  if (sku && sku.length > 60) return { ok: false, error: "La referencia es demasiado larga (máximo 60)." };

  const textoStock = texto(fd, "stock") || "0";
  const stock = Number(textoStock);
  if (!/^\d+$/.test(textoStock) || stock > 100000) {
    return { ok: false, error: "El stock debe ser un número entero entre 0 y 100.000." };
  }
  return { ok: true, datos: { size, color, sku, stock } };
}
