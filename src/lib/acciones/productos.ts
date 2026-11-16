"use server";

import { redirect } from "next/navigation";
import { exigirTienda } from "@/lib/datos/sesion";
import { expandirTallas } from "@/lib/domain/tallas";
import type { EstadoAccion } from "./estado";
import { ERROR_GENERICO, actualizar, fallo, leerId, mensajeDeError, registrarError } from "./comun";
import { leerProducto, leerVariante } from "./formularios";

/**
 * Productos y su tabla de tallas.
 * La tienda siempre sale de la sesión; toda escritura filtra también por
 * shop_id (además de RLS).
 */

// ---------------------------------------------------------------------
// Producto
// ---------------------------------------------------------------------
export async function crearProducto(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, tienda } = await exigirTienda();
  const datos = leerProducto(fd);
  if (!datos.ok) return fallo(datos.error);

  const { data, error } = await supabase
    .from("products")
    .insert({ ...datos.datos, shop_id: tienda.id })
    .select("id")
    .single();
  if (error || !data) {
    registrarError("crearProducto", error);
    return fallo(mensajeDeError(error));
  }
  actualizar(tienda.slug);
  // A la ficha, para añadir las tallas
  redirect(`/panel/productos/${data.id}?nuevo=1`);
}

export async function guardarProducto(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, tienda } = await exigirTienda();
  const id = leerId(fd);
  const datos = leerProducto(fd);
  if (!id) return fallo("Producto no válido.");
  if (!datos.ok) return fallo(datos.error);

  const { data, error } = await supabase
    .from("products")
    .update(datos.datos)
    .eq("id", id)
    .eq("shop_id", tienda.id)
    .select("id");
  if (error || !data?.length) {
    registrarError("guardarProducto", error, { id, filas: data?.length ?? 0 });
    return fallo(mensajeDeError(error));
  }
  actualizar(tienda.slug);
  return { ok: true, mensaje: "Producto guardado." };
}

/** Borra el producto. Si alguna talla tiene reservas activas, la BD lo impide. */
export async function borrarProducto(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, tienda } = await exigirTienda();
  const id = leerId(fd);
  if (!id) return fallo("Producto no válido.");

  const { error } = await supabase.from("products").delete().eq("id", id).eq("shop_id", tienda.id);
  if (error) {
    if (error.hint !== "reservas_activas") registrarError("borrarProducto", error, { id });
    return fallo(mensajeDeError(error));
  }
  actualizar(tienda.slug);
  redirect("/panel/productos");
}

export async function alternarActivo(fd: FormData): Promise<void> {
  const { supabase, tienda } = await exigirTienda();
  const id = leerId(fd);
  if (!id) return;
  const { error } = await supabase
    .from("products")
    .update({ is_active: fd.get("activo") === "true" })
    .eq("id", id)
    .eq("shop_id", tienda.id);
  if (error) registrarError("alternarActivo", error, { id });
  actualizar(tienda.slug);
}

// ---------------------------------------------------------------------
// Tallas
// ---------------------------------------------------------------------
/**
 * "Añadir tallas en bloque": crea una fila por talla (stock 0).
 * Las que ya existen (misma talla y color) se saltan y se avisa.
 */
export async function anadirTallas(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, tienda } = await exigirTienda();
  const producto = leerId(fd, "producto");
  if (!producto) return fallo("Producto no válido.");

  const tallas = expandirTallas(String(fd.get("tallas") ?? ""));
  if (!tallas.ok) return fallo(tallas.error);
  const color = String(fd.get("color") ?? "").trim() || null;
  if (color && color.length > 40) return fallo("El color es demasiado largo (máximo 40).");

  const { data: actuales, error: e1 } = await supabase
    .from("variants")
    .select("size, color, position")
    .eq("product_id", producto)
    .eq("shop_id", tienda.id);
  if (e1) {
    registrarError("anadirTallas (leer)", e1);
    return fallo(ERROR_GENERICO);
  }

  const clave = (talla: string, c: string | null) => `${talla.toLowerCase()}|${(c ?? "").toLowerCase()}`;
  const yaEstan = new Set((actuales ?? []).map((v) => clave(v.size, v.color)));
  const nuevas = tallas.tallas.filter((t) => !yaEstan.has(clave(t, color)));
  const saltadas = tallas.tallas.length - nuevas.length;
  if (nuevas.length === 0) return fallo("Todas esas tallas ya existen en este producto.");

  const base = (actuales ?? []).reduce((max, v) => Math.max(max, v.position), -1) + 1;
  const { error } = await supabase.from("variants").insert(
    nuevas.map((size, i) => ({
      shop_id: tienda.id,
      product_id: producto,
      size,
      color,
      stock: 0,
      position: base + i,
    })),
  );
  if (error) {
    registrarError("anadirTallas", error, { producto });
    return fallo(mensajeDeError(error));
  }
  actualizar(tienda.slug);
  return {
    ok: true,
    mensaje:
      `Añadidas ${nuevas.length} talla(s).` +
      (saltadas ? ` ${saltadas} ya existían y se han dejado como estaban.` : "") +
      " Ahora pon el stock de cada una.",
  };
}

/** Guarda una fila de la tabla de tallas (talla, color, referencia y stock). */
export async function guardarVariante(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, tienda } = await exigirTienda();
  const id = leerId(fd);
  const datos = leerVariante(fd);
  if (!id) return fallo("Talla no válida.");
  if (!datos.ok) return fallo(datos.error);

  const { data, error } = await supabase
    .from("variants")
    .update(datos.datos)
    .eq("id", id)
    .eq("shop_id", tienda.id)
    .select("id");
  if (error || !data?.length) {
    if (error?.code !== "23505") registrarError("guardarVariante", error, { id });
    return fallo(mensajeDeError(error));
  }
  actualizar(tienda.slug);
  return { ok: true, mensaje: "Guardado." };
}

/** Botones +1 / −1: ajuste atómico en la base de datos (sin carreras). */
export async function ajustarStock(fd: FormData): Promise<void> {
  const { supabase, tienda } = await exigirTienda();
  const id = leerId(fd);
  const delta = Number(fd.get("delta"));
  if (!id || ![-1, 1].includes(delta)) return;
  const { error } = await supabase.rpc("ajustar_stock", { p_variante: id, p_delta: delta });
  // "negativo" es esperable (pulsar −1 con stock 0): no es un fallo del sistema
  if (error && error.hint !== "negativo") registrarError("ajustarStock", error, { id, delta });
  actualizar(tienda.slug);
}

/** Borra una talla. Si tiene reservas activas, la BD lo impide y se avisa. */
export async function borrarVariante(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, tienda } = await exigirTienda();
  const id = leerId(fd);
  if (!id) return fallo("Talla no válida.");
  const { error } = await supabase.from("variants").delete().eq("id", id).eq("shop_id", tienda.id);
  if (error) {
    if (error.hint !== "reservas_activas") registrarError("borrarVariante", error, { id });
    return fallo(mensajeDeError(error));
  }
  actualizar(tienda.slug);
  return { ok: true, mensaje: "Talla borrada." };
}
