import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cargarCatalogoPublico } from "@/lib/datos/catalogoPublico";
import { hayDisponible } from "@/lib/domain/catalogoPublico";
import { formatearPrecio } from "@/lib/domain/precio";
import { CabeceraTienda } from "../../CabeceraTienda";
import { FormularioReserva } from "./FormularioReserva";

export const metadata: Metadata = { title: "Producto" };

/** Ficha pública de producto con "Resérvalo y recógelo". */
export default function PaginaFicha({ params }: PageProps<"/t/[slug]/p/[id]">) {
  return (
    <Suspense fallback={<p className="p-6 text-center text-neutral-500">Cargando…</p>}>
      <Ficha params={params} />
    </Suspense>
  );
}

async function Ficha({ params }: Pick<PageProps<"/t/[slug]/p/[id]">, "params">) {
  const { slug, id } = await params;
  // Reutiliza el catálogo cacheado: no hay consultas extra por producto
  const catalogo = await cargarCatalogoPublico(slug);
  const p = catalogo?.productos.find((x) => x.id === id);
  if (!catalogo || !p) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
      <CabeceraTienda tienda={catalogo.tienda} />
      <Link href={`/t/${slug}`} className="mt-4 inline-block text-sm underline">← Volver al catálogo</Link>

      <article className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-1">
          {p.descuento !== null && (
            <span className="rounded bg-orange-400 px-2 py-0.5 text-sm font-bold text-white">-{p.descuento} %</span>
          )}
          {p.nuevo && <span className="rounded bg-sky-500 px-2 py-0.5 text-sm font-bold text-white">NUEVO</span>}
        </div>
        <h1 className="text-3xl font-bold">{p.nombre}</h1>
        {p.marca && <p className="text-neutral-500">{p.marca}</p>}
        <p className="text-2xl">
          {p.ofertaCentimos !== null ? (
            <>
              <span className="text-lg text-neutral-400 line-through">{formatearPrecio(p.precioCentimos)}</span>{" "}
              <strong>{formatearPrecio(p.ofertaCentimos)}</strong>
            </>
          ) : (
            <strong>{formatearPrecio(p.precioCentimos)}</strong>
          )}
        </p>
        {p.descripcion && <p className="whitespace-pre-line text-neutral-700">{p.descripcion}</p>}

        {hayDisponible(p) ? (
          <FormularioReserva
            slug={slug}
            tienda={catalogo.tienda}
            producto={{ nombre: p.nombre, tallas: p.tallas }}
          />
        ) : (
          <p className="rounded-xl bg-neutral-100 p-4 text-neutral-700">
            Ahora mismo está agotado en tienda en todas sus tallas. Si quieres, pregunta a la tienda por WhatsApp cuándo
            les llega.
          </p>
        )}
      </article>
    </div>
  );
}
