import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { exigirTienda } from "@/lib/datos/sesion";
import { cargarCatalogo, cargarProductos, POCAS_UNIDADES } from "@/lib/datos/catalogo";
import { ListaProductos } from "./ListaProductos";

export const metadata: Metadata = { title: "Productos · LorpenaPa" };

export default function PaginaProductos() {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Productos</h1>
        <Link href="/panel/productos/nuevo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">
          + Nuevo producto
        </Link>
      </div>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </section>
  );
}

async function Contenido() {
  const ctx = await exigirTienda();
  const [productos, { categorias, marcas }] = await Promise.all([cargarProductos(ctx), cargarCatalogo(ctx)]);

  if (productos.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-8 text-center">
        <p className="font-semibold">Todavía no tienes productos.</p>
        <p className="mt-1 text-sm text-neutral-600">
          Consejo: crea antes tus categorías y marcas en la pestaña «Categorías y marcas»; así podrás asignarlas al
          dar de alta cada producto.
        </p>
      </div>
    );
  }

  return (
    <ListaProductos
      productos={productos}
      categorias={categorias.map((c) => ({ id: c.id, nombre: c.name }))}
      marcas={marcas.map((m) => ({ id: m.id, nombre: m.name }))}
      pocasUnidades={POCAS_UNIDADES}
    />
  );
}
