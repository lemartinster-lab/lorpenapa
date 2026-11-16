import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { exigirSesion, obtenerTienda } from "@/lib/datos/sesion";
import { FormularioNueva } from "./FormularioNueva";

export const metadata: Metadata = { title: "Nueva tienda · LorpenaPa" };

export default function PaginaNueva() {
  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Da de alta tu tienda</h1>
      <p className="mt-1 text-neutral-600">Solo el nombre es obligatorio. Lo demás lo puedes cambiar después.</p>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </section>
  );
}

async function Contenido() {
  const sesion = await exigirSesion();
  if (await obtenerTienda(sesion)) redirect("/panel/productos");
  return <FormularioNueva />;
}
