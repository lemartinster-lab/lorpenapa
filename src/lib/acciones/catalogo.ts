"use server";

import { refresh } from "next/cache";
import { exigirTienda, type ContextoTienda } from "@/lib/datos/sesion";
import type { EstadoAccion } from "./estado";
import { ERROR_GENERICO, fallo, leerId, mensajeDeError, registrarError } from "./comun";
import { buscarDuplicado, leerNombre } from "./formularios";

/**
 * Categorías y marcas. La tienda siempre sale de la sesión; toda escritura
 * filtra también por shop_id (además de RLS). La base de datos impide los
 * duplicados; aquí se comprueban antes para dar un mensaje claro.
 */

type Tabla = "categories" | "brands";
const QUE: Record<Tabla, "categoría" | "marca"> = { categories: "categoría", brands: "marca" };

async function existentes(ctx: ContextoTienda, tabla: Tabla) {
  const { data, error } = await ctx.supabase.from(tabla).select("id, name").eq("shop_id", ctx.tienda.id);
  if (error) registrarError(`leer ${tabla}`, error);
  return data ?? [];
}

async function crear(tabla: Tabla, fd: FormData): Promise<EstadoAccion> {
  const ctx = await exigirTienda();
  const datos = leerNombre(fd, QUE[tabla]);
  if (!datos.ok) return fallo(datos.error);

  const lista = await existentes(ctx, tabla);
  const dup = buscarDuplicado(lista, datos.datos.name);
  if (dup) return fallo(`Ya tienes una ${QUE[tabla]} «${dup}».`);

  const { error } =
    tabla === "categories"
      ? await ctx.supabase
          .from("categories")
          .insert({ shop_id: ctx.tienda.id, name: datos.datos.name, position: lista.length })
      : await ctx.supabase.from("brands").insert({ shop_id: ctx.tienda.id, name: datos.datos.name });
  if (error) {
    registrarError(`crear ${tabla}`, error);
    return fallo(mensajeDeError(error));
  }
  refresh();
  return { ok: true, mensaje: `${QUE[tabla] === "marca" ? "Marca" : "Categoría"} «${datos.datos.name}» creada.` };
}

async function renombrar(tabla: Tabla, fd: FormData): Promise<EstadoAccion> {
  const ctx = await exigirTienda();
  const id = leerId(fd);
  const datos = leerNombre(fd, QUE[tabla]);
  if (!id) return fallo(`${QUE[tabla]} no válida.`);
  if (!datos.ok) return fallo(datos.error);

  const dup = buscarDuplicado(await existentes(ctx, tabla), datos.datos.name, id);
  if (dup) return fallo(`Ya tienes una ${QUE[tabla]} «${dup}».`);

  const { data, error } = await ctx.supabase
    .from(tabla)
    .update({ name: datos.datos.name })
    .eq("id", id)
    .eq("shop_id", ctx.tienda.id)
    .select("id");
  if (error || !data?.length) {
    registrarError(`renombrar ${tabla}`, error, { id });
    return fallo(mensajeDeError(error, ERROR_GENERICO));
  }
  refresh();
  return { ok: true, mensaje: "Guardado." };
}

/** Borrar: sus productos no se borran, se quedan sin categoría o sin marca. */
async function borrar(tabla: Tabla, fd: FormData): Promise<void> {
  const { supabase, tienda } = await exigirTienda();
  const id = leerId(fd);
  if (!id) return;
  const { error } = await supabase.from(tabla).delete().eq("id", id).eq("shop_id", tienda.id);
  if (error) registrarError(`borrar ${tabla}`, error, { id });
  refresh();
}

export async function crearCategoria(_p: EstadoAccion, fd: FormData) {
  return crear("categories", fd);
}
export async function renombrarCategoria(_p: EstadoAccion, fd: FormData) {
  return renombrar("categories", fd);
}
export async function borrarCategoria(fd: FormData) {
  return borrar("categories", fd);
}
export async function crearMarca(_p: EstadoAccion, fd: FormData) {
  return crear("brands", fd);
}
export async function renombrarMarca(_p: EstadoAccion, fd: FormData) {
  return renombrar("brands", fd);
}
export async function borrarMarca(fd: FormData) {
  return borrar("brands", fd);
}

/** Sube o baja una categoría; renumera todas 0..n-1 con el cambio aplicado. */
export async function moverCategoria(fd: FormData): Promise<void> {
  const ctx = await exigirTienda();
  const id = leerId(fd);
  const direccion = fd.get("direccion") === "arriba" ? -1 : 1;
  if (!id) return;

  const { data: lista, error } = await ctx.supabase
    .from("categories")
    .select("id")
    .eq("shop_id", ctx.tienda.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !lista) return registrarError("moverCategoria (leer)", error);

  const i = lista.findIndex((c) => c.id === id);
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= lista.length) return;

  const orden = lista.map((c) => c.id);
  [orden[i], orden[j]] = [orden[j], orden[i]];
  const resultados = await Promise.all(
    orden.map((catId, pos) =>
      ctx.supabase.from("categories").update({ position: pos }).eq("id", catId).eq("shop_id", ctx.tienda.id),
    ),
  );
  const conError = resultados.find((r) => r.error);
  if (conError) registrarError("moverCategoria", conError.error, { id });
  refresh();
}
