"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { filtrarProductos, hayDisponible, type CatalogoPublico, type ProductoPublico } from "@/lib/domain/catalogoPublico";
import { formatearPrecio } from "@/lib/domain/precio";

const campo = "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm";

/** Catálogo con filtros instantáneos (en el navegador). */
export function VistaCatalogo({ catalogo }: { catalogo: CatalogoPublico }) {
  const [categoria, setCategoria] = useState("");
  const [marca, setMarca] = useState("");
  const [talla, setTalla] = useState("");
  const [soloOfertas, setSoloOfertas] = useState(false);

  const visibles = useMemo(
    () => filtrarProductos(catalogo.productos, { categoria, marca, talla, soloOfertas }),
    [catalogo.productos, categoria, marca, talla, soloOfertas],
  );
  const hayOfertas = catalogo.productos.some((p) => p.descuento !== null);
  const filtrando = Boolean(categoria || marca || talla || soloOfertas);

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Categorías como pestañas */}
      {catalogo.categorias.length > 1 && (
        <nav aria-label="Categorías" className="flex gap-2 overflow-x-auto pb-1">
          {[{ id: "", nombre: "Todo" }, ...catalogo.categorias].map((c) => (
            <button
              key={c.id || "todo"}
              type="button"
              aria-pressed={categoria === c.id}
              onClick={() => setCategoria(c.id)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold whitespace-nowrap uppercase ${
                categoria === c.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {catalogo.tallas.length > 0 && (
          <select value={talla} onChange={(e) => setTalla(e.target.value)} aria-label="Mi talla" className={campo}>
            <option value="">Mi talla: todas</option>
            {catalogo.tallas.map((t) => (
              <option key={t} value={t}>Mi talla: {t}</option>
            ))}
          </select>
        )}
        {catalogo.marcas.length > 1 && (
          <select value={marca} onChange={(e) => setMarca(e.target.value)} aria-label="Marca" className={campo}>
            <option value="">Todas las marcas</option>
            {catalogo.marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        )}
        {hayOfertas && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soloOfertas} onChange={(e) => setSoloOfertas(e.target.checked)} />
            Solo ofertas
          </label>
        )}
        {filtrando && (
          <button
            type="button"
            onClick={() => {
              setCategoria("");
              setMarca("");
              setTalla("");
              setSoloOfertas(false);
            }}
            className="text-sm underline"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {talla && (
        <p className="text-sm text-neutral-600">
          Mostrando productos con la talla <strong>{talla}</strong> disponible ahora en tienda.
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="py-12 text-center text-neutral-600">
          {catalogo.productos.length === 0
            ? "Esta tienda todavía no tiene productos en su catálogo."
            : "No hay productos con esos filtros. Prueba a quitar alguno."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((p) => (
            <Tarjeta key={p.id} producto={p} slug={catalogo.tienda.slug} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Tarjeta({ producto: p, slug }: { producto: ProductoPublico; slug: string }) {
  const disponible = hayDisponible(p);
  return (
    <li className="relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {p.descuento !== null && (
        <p className="bg-orange-400 py-1 text-center text-sm font-bold text-white uppercase">¡En oferta!</p>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1">
          {p.descuento !== null && (
            <span className="rounded bg-orange-400 px-2 py-0.5 text-sm font-bold text-white">-{p.descuento} %</span>
          )}
          {p.nuevo && <span className="rounded bg-sky-500 px-2 py-0.5 text-sm font-bold text-white">NUEVO</span>}
        </div>
        <h2 className="font-semibold">
          <Link href={`/t/${slug}/p/${p.id}`} className="after:absolute after:inset-0">
            {p.nombre}
          </Link>
        </h2>
        {p.marca && <p className="text-sm text-neutral-500">{p.marca}</p>}
        <p className="text-lg">
          {p.ofertaCentimos !== null ? (
            <>
              <span className="text-base text-neutral-400 line-through">{formatearPrecio(p.precioCentimos)}</span>{" "}
              <strong>{formatearPrecio(p.ofertaCentimos)}</strong>
            </>
          ) : (
            <strong>{formatearPrecio(p.precioCentimos)}</strong>
          )}
        </p>
        <ul className="mt-auto flex flex-wrap gap-1" aria-label="Tallas">
          {p.tallas.map((t) => (
            <li
              key={t.id}
              title={t.estado === "agotada" ? "Agotada" : t.estado === "ultimas" ? "Últimas unidades" : "Disponible"}
              className={`rounded border px-2 py-0.5 text-xs ${
                t.estado === "agotada"
                  ? "border-neutral-200 text-neutral-300 line-through"
                  : t.estado === "ultimas"
                    ? "border-amber-400 bg-amber-50"
                    : "border-neutral-300"
              }`}
            >
              {t.talla}
              {t.color ? ` · ${t.color}` : ""}
            </li>
          ))}
        </ul>
        {!disponible && <p className="text-sm font-semibold text-neutral-500">Agotado en tienda</p>}
      </div>
    </li>
  );
}
