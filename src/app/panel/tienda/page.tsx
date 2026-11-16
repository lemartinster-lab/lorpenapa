import type { Metadata } from "next";
import { Suspense } from "react";
import { exigirTienda } from "@/lib/datos/sesion";
import { FormularioTienda } from "./FormularioTienda";

export const metadata: Metadata = { title: "Tienda · LorpenaPa" };

export default function PaginaTienda() {
  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-bold">Datos de la tienda</h1>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </section>
  );
}

async function Contenido() {
  const { tienda, rol } = await exigirTienda();
  return (
    <>
      <p className="mt-1 text-sm text-neutral-600">
        Dirección del catálogo: <span className="font-mono">/t/{tienda.slug}</span>
      </p>
      {rol !== "owner" && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Solo el propietario puede cambiar estos datos. Puedes consultarlos, pero no guardarlos.
        </p>
      )}
      <FormularioTienda tienda={tienda} soloLectura={rol !== "owner"} />
    </>
  );
}
