import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { exigirTienda } from "@/lib/datos/sesion";
import { cargarCatalogo, cargarProducto } from "@/lib/datos/catalogo";
import { idSchema } from "@/lib/acciones/formularios";
import { borrarProducto } from "@/lib/acciones/productos";
import { FormularioProducto } from "../FormularioProducto";
import { BotonBorrarConAviso } from "../../ui";
import { AnadirTallas, TablaTallas } from "./Tallas";

export const metadata: Metadata = { title: "Producto · LorpenaPa" };

export default function PaginaProducto({ params, searchParams }: PageProps<"/panel/productos/[id]">) {
  return (
    <section className="max-w-3xl">
      <Link href="/panel/productos" className="text-sm underline">← Productos</Link>
      {/* params y searchParams dependen de la petición → Suspense */}
      <Suspense fallback={<p className="mt-6 text-neutral-500">Cargando…</p>}>
        <Contenido params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Contenido(props: Pick<PageProps<"/panel/productos/[id]">, "params" | "searchParams">) {
  const { id } = await props.params;
  const recienCreado = (await props.searchParams).nuevo === "1";
  if (!idSchema.safeParse(id).success) notFound();

  const ctx = await exigirTienda();
  const [datos, { categorias, marcas }] = await Promise.all([cargarProducto(ctx, id), cargarCatalogo(ctx)]);
  if (!datos) notFound();
  const { producto, variantes } = datos;

  return (
    <div className="mt-2 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{producto.name}</h1>

      {recienCreado && variantes.length === 0 && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900" role="status">
          ✓ Producto creado. Ahora añade sus tallas (o «Única» si no tiene) y el stock de cada una.
        </p>
      )}

      <section aria-labelledby="titulo-tallas" className="flex flex-col gap-3">
        <h2 id="titulo-tallas" className="text-lg font-semibold">Tallas y stock</h2>
        <TablaTallas variantes={variantes} />
        <AnadirTallas productoId={producto.id} />
      </section>

      <section aria-labelledby="titulo-datos" className="flex flex-col gap-3">
        <h2 id="titulo-datos" className="text-lg font-semibold">Datos del producto</h2>
        <FormularioProducto
          producto={producto}
          categorias={categorias.map((c) => ({ id: c.id, nombre: c.name }))}
          marcas={marcas.map((m) => ({ id: m.id, nombre: m.name }))}
        />
      </section>

      <section className="rounded-xl border border-red-200 p-4">
        <h2 className="font-semibold text-red-900">Borrar producto</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Se borran también todas sus tallas. Si solo quieres ocultarlo, desmarca «Activo».
        </p>
        <BotonBorrarConAviso
          accion={borrarProducto}
          campos={{ id: producto.id }}
          texto="Borrar producto"
          pregunta="¿Seguro? No se puede deshacer."
        />
      </section>
    </div>
  );
}
