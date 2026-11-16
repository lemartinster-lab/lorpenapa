"use server";

import { updateTag } from "next/cache";
import { clientePublico } from "@/lib/supabase/publico";
import { exigirTienda } from "@/lib/datos/sesion";
import { etiquetaTienda } from "@/lib/domain/catalogoPublico";
import type { EstadoAccion } from "./estado";
import { actualizar, fallo, leerId, registrarError } from "./comun";
import { leerReserva, mensajeErrorReserva } from "./formularios";

// ---------------------------------------------------------------------
// Pública: "Resérvalo y recógelo" (sin sesión)
// ---------------------------------------------------------------------
export type EstadoReservaPublica =
  | { ok: false; error?: string }
  | { ok: true; codigo: string; caduca: string; talla: string; cantidad: number };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Crea la reserva con la función atómica crear_reserva() usando el cliente
 * ANÓNIMO: la base de datos comprueba tienda publicada, producto activo,
 * disponibilidad (con bloqueo), consentimiento y límite por teléfono.
 */
export async function reservar(_p: EstadoReservaPublica, fd: FormData): Promise<EstadoReservaPublica> {
  const datos = leerReserva(fd);
  if (!datos.ok) {
    if ("bot" in datos) console.warn("[lorpenapa] reserva descartada por el campo trampa");
    return { ok: false, error: datos.error };
  }

  const slug = String(fd.get("tienda") ?? "");
  if (!SLUG.test(slug)) return { ok: false, error: "Tienda no válida." };

  const { data, error } = await clientePublico().rpc("crear_reserva", {
    p_variante: datos.datos.varianteId,
    p_nombre: datos.datos.nombre,
    p_telefono: datos.datos.telefono,
    p_cantidad: datos.datos.cantidad,
    p_consentimiento: true, // leerReserva ya exige la casilla marcada
  });

  if (error || !data?.[0]) {
    const esperable = ["sin_stock", "limite", "no_disponible"].includes(error?.hint ?? "");
    if (!esperable) registrarError("reservar", error);
    // Si se agotó entre medias, renovamos el catálogo para que lo refleje
    if (error?.hint === "sin_stock") updateTag(etiquetaTienda(slug));
    return { ok: false, error: mensajeErrorReserva(error?.hint) };
  }

  // La talla tiene ahora menos unidades disponibles
  updateTag(etiquetaTienda(slug));
  return {
    ok: true,
    codigo: data[0].codigo,
    caduca: data[0].caduca,
    talla: String(fd.get("nombre_talla") ?? ""),
    cantidad: datos.datos.cantidad,
  };
}

// ---------------------------------------------------------------------
// Panel: gestionar reservas
// ---------------------------------------------------------------------
export async function confirmarReserva(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return cambiarEstado(fd, "confirmed", "Reserva confirmada.");
}

export async function cancelarReserva(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  return cambiarEstado(fd, "cancelled", "Reserva cancelada: la unidad vuelve a estar disponible.");
}

async function cambiarEstado(fd: FormData, estado: "confirmed" | "cancelled", mensaje: string): Promise<EstadoAccion> {
  const { supabase, tienda } = await exigirTienda();
  const id = leerId(fd);
  if (!id) return fallo("Reserva no válida.");

  const { data, error } = await supabase
    .from("reservations")
    .update({ status: estado })
    .eq("id", id)
    .eq("shop_id", tienda.id)
    .select("id");
  if (error || !data?.length) {
    if (error?.hint === "cerrada") return fallo("Esta reserva ya está cerrada.");
    registrarError(`reserva → ${estado}`, error, { id });
    return fallo("No se pudo actualizar la reserva. Inténtalo de nuevo.");
  }
  actualizar(tienda.slug);
  return { ok: true, mensaje };
}

/** Entrega en tienda: descuenta el stock y cierra la reserva (función atómica). */
export async function entregarReserva(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, tienda } = await exigirTienda();
  const id = leerId(fd);
  if (!id) return fallo("Reserva no válida.");

  const { error } = await supabase.rpc("marcar_recogida", { p_reserva: id });
  if (error) {
    if (error.hint === "sin_stock" || error.hint === "cerrada") return fallo(error.message ?? "No se pudo entregar.");
    registrarError("entregarReserva", error, { id });
    return fallo("No se pudo marcar como entregada. Inténtalo de nuevo.");
  }
  actualizar(tienda.slug);
  return { ok: true, mensaje: "Entregada: el stock se ha descontado." };
}
