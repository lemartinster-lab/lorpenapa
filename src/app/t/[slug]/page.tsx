import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cargarCatalogoPublico } from "@/lib/datos/catalogoPublico";
import { VistaCatalogo } from "./VistaCatalogo";
import { CabeceraTienda } from "./CabeceraTienda";

export const metadata: Metadata = { title: "Catálogo" };

/** Catálogo público de una tienda: /t/<slug>. */
export default function PaginaCatalogo({ params }: PageProps<"/t/[slug]">) {
  return (
    <Suspense fallback={<p className="p-6 text-center text-neutral-500">Cargando el catálogo…</p>}>
      <Catalogo params={params} />
    </Suspense>
  );
}

async function Catalogo({ params }: Pick<PageProps<"/t/[slug]">, "params">) {
  const { slug } = await params;
  const catalogo = await cargarCatalogoPublico(slug);
  if (!catalogo) notFound();
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
      <CabeceraTienda tienda={catalogo.tienda} />
      <VistaCatalogo catalogo={catalogo} />
    </div>
  );
}
