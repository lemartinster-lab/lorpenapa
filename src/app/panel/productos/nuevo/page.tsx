import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigirTienda } from "@/lib/datos/sesion";
import { cargarCatalogo } from "@/lib/datos/catalogo";
import { FormularioProducto } from "../FormularioProducto";

export const metadata: Metadata = { title: "Nuevo producto · LorpenaPa" };

export default function PaginaNuevoProducto() {
  return (
    <section className="max-w-2xl">
      <Link href="/panel/productos" className="text-sm underline">← Productos</Link>
      <h1 className="mt-2 text-2xl font-bold">Nuevo producto</h1>
      <p className="mt-1 text-sm text-neutral-600">Primero los datos generales; en el siguiente paso, las tallas y el stock.</p>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </section>
  );
}

async function Contenido() {
  const ctx = await exigirTienda();
  const { categorias, marcas } = await cargarCatalogo(ctx);
  return (
    <div className="mt-6">
      <FormularioProducto
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.name }))}
        marcas={marcas.map((m) => ({ id: m.id, nombre: m.name }))}
      />
    </div>
  );
}
