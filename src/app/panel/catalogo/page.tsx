import type { Metadata } from "next";
import { Suspense } from "react";
import { exigirTienda } from "@/lib/datos/sesion";
import { cargarCatalogo } from "@/lib/datos/catalogo";
import { ListaEditable } from "./ListaEditable";

export const metadata: Metadata = { title: "Categorías y marcas · LorpenaPa" };

export default function PaginaCatalogo() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Categorías y marcas</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Organizan tu catálogo y sirven de filtro a tus clientes. Si borras una, sus productos no se borran.
      </p>
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
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <ListaEditable
        tipo="categoria"
        titulo="Categorías"
        ejemplo="Ej.: Hombre"
        elementos={categorias.map((c) => ({ id: c.id, name: c.name }))}
      />
      <ListaEditable
        tipo="marca"
        titulo="Marcas"
        ejemplo="Ej.: Joluvi"
        elementos={marcas.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
