"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { exigirSesion, exigirTienda } from "@/lib/datos/sesion";
import type { EstadoAccion } from "./estado";
import { fallo, mensajeDeError, registrarError } from "./comun";
import { leerDatosTienda, leerNuevaTienda } from "./formularios";

/** Alta de la tienda. Quien la crea queda como propietario (trigger SQL). */
export async function crearTienda(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase } = await exigirSesion();
  const datos = leerNuevaTienda(fd);
  if (!datos.ok) return fallo(datos.error);

  const { error } = await supabase.from("shops").insert(datos.datos).select("id").single();
  if (error) {
    if (error.code !== "23505") registrarError("crearTienda", error);
    return fallo(mensajeDeError(error, "No se pudo crear la tienda. Inténtalo de nuevo."));
  }
  redirect("/panel/productos");
}

/** Datos de la tienda. Solo el propietario: RLS deja 0 filas a los empleados. */
export async function guardarDatosTienda(_p: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  const { supabase, tienda } = await exigirTienda();
  const datos = leerDatosTienda(fd);
  if (!datos.ok) return fallo(datos.error);

  const { data, error } = await supabase.from("shops").update(datos.datos).eq("id", tienda.id).select("id");
  if (error) {
    registrarError("guardarDatosTienda", error);
    return fallo(mensajeDeError(error));
  }
  if (!data?.length) return fallo("Solo el propietario puede cambiar los datos de la tienda.");
  refresh();
  return { ok: true, mensaje: "Datos guardados." };
}
