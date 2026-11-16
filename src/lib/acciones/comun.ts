import "server-only";
import { idSchema } from "./formularios";
import type { EstadoAccion } from "./estado";

/**
 * Ayudantes comunes de las Server Actions del panel.
 * El usuario ve mensajes amables; el detalle técnico va al registro del
 * servidor (Terminal de `npm run dev`, logs de Vercel).
 */

export const ERROR_GENERICO = "No se pudo guardar. Inténtalo de nuevo.";

export const fallo = (error: string): EstadoAccion => ({ ok: false, error });

export type ErrorSupabase = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export function registrarError(accion: string, error: ErrorSupabase | null | undefined, extra?: Record<string, unknown>) {
  console.error(`[lorpenapa] ${accion} falló`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    ...extra,
  });
}

export function leerId(fd: FormData, campo = "id"): string | null {
  const r = idSchema.safeParse(fd.get(campo));
  return r.success ? r.data : null;
}

/**
 * Traduce los errores de la base de datos a mensajes para el tendero.
 * Las funciones SQL propias llevan un "hint" estable; los mensajes de esas
 * funciones ya están en español y se muestran tal cual.
 */
export function mensajeDeError(error: ErrorSupabase | null | undefined, porDefecto = ERROR_GENERICO): string {
  if (!error) return porDefecto;
  const hintsPropios = ["reservas_activas", "negativo", "delta", "sin_stock", "cerrada"];
  if (error.hint && hintsPropios.includes(error.hint) && error.message) return error.message;

  if (error.code === "23505") {
    const m = `${error.message ?? ""} ${error.details ?? ""}`;
    if (m.includes("variants_unica")) return "Ya existe esa talla (con ese color) en este producto.";
    if (m.includes("categories_nombre_unico")) return "Ya tienes una categoría con ese nombre.";
    if (m.includes("brands_nombre_unico")) return "Ya tienes una marca con ese nombre.";
    if (m.includes("shops_slug_key")) return "Esa dirección web ya está en uso. Prueba con otra.";
    return "Ya existe un elemento igual.";
  }
  if (error.code === "23503") return "La categoría o la marca elegida ya no existe.";
  if (error.code === "23514" && (error.message ?? "").includes("oferta_menor_que_precio")) {
    return "El precio de oferta tiene que ser menor que el precio normal.";
  }
  return porDefecto;
}
