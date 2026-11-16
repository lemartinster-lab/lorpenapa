"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { alternarActivo } from "@/lib/acciones/productos";
import { formatearPrecio, porcentajeDescuento } from "@/lib/domain/precio";
import type { ResumenProducto } from "@/lib/datos/catalogo";
import { normalizarNombre } from "@/lib/acciones/formularios";
import { estilos } from "../ui";

type Opcion = { id: string; nombre: string };

/** Lista de productos con buscador y filtros (en el navegador, al instante). */
export function ListaProductos(props: {
  productos: ResumenProducto[];
  categorias: Opcion[];
  marcas: Opcion[];
  pocasUnidades: number;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [marca, setMarca] = useState("");
  const [estado, setEstado] = useState<"" | "activos" | "inactivos" | "sin_stock">("");

  const nombreDe = (lista: Opcion[], id: string | null) => lista.find((o) => o.id === id)?.nombre;

  const visibles = useMemo(() => {
    const q = normalizarNombre(busqueda);
    return props.productos.filter(
      (p) =>
        (!q || normalizarNombre(p.name).includes(q)) &&
        (!categoria || p.category_id === categoria) &&
        (!marca || p.brand_id === marca) &&
        (estado === "" ||
          (estado === "activos" && p.is_active) ||
          (estado === "inactivos" && !p.is_active) ||
          (estado === "sin_stock" && p.stockTotal === 0)),
    );
  }, [props.productos, busqueda, categoria, marca, estado]);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          aria-label="Buscar producto"
          className={`${estilos.campo} sm:col-span-4`}
        />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría" className={estilos.campo}>
          <option value="">Todas las categorías</option>
          {props.categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <select value={marca} onChange={(e) => setMarca(e.target.value)} aria-label="Marca" className={estilos.campo}>
          <option value="">Todas las marcas</option>
          {props.marcas.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as typeof estado)}
          aria-label="Estado"
          className={`${estilos.campo} sm:col-span-2`}
        >
          <option value="">Activos e inactivos</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
          <option value="sin_stock">Sin stock</option>
        </select>
      </div>

      <p className="text-sm text-neutral-600">
        {visibles.length} de {props.productos.length} producto(s)
      </p>

      <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {visibles.map((p) => {
          const descuento = porcentajeDescuento(p.price_cents, p.sale_price_cents);
          return (
            <li key={p.id} className={`flex flex-wrap items-center justify-between gap-3 p-4 ${p.is_active ? "" : "opacity-60"}`}>
              <div className="min-w-0">
                <Link href={`/panel/productos/${p.id}`} className="font-semibold hover:underline">
                  {p.name}
                </Link>
                {p.is_new && <span className="ml-2 rounded bg-sky-500 px-1.5 py-0.5 text-xs font-bold text-white">NUEVO</span>}
                {!p.is_active && <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs">Inactivo</span>}
                <p className="text-sm text-neutral-600">
                  {[nombreDe(props.categorias, p.category_id), nombreDe(props.marcas, p.brand_id)].filter(Boolean).join(" · ") ||
                    "Sin categoría ni marca"}
                </p>
                <p className="mt-1 text-sm">
                  {p.sale_price_cents !== null ? (
                    <>
                      <span className="text-neutral-500 line-through">{formatearPrecio(p.price_cents)}</span>{" "}
                      <strong>{formatearPrecio(p.sale_price_cents)}</strong>{" "}
                      <span className="rounded bg-orange-300 px-1 text-xs font-bold">-{descuento} %</span>
                    </>
                  ) : (
                    <strong>{formatearPrecio(p.price_cents)}</strong>
                  )}
                </p>
                <p className="mt-1 text-xs">
                  {p.tallas === 0 ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">⚠ Sin tallas: añádelas en la ficha</span>
                  ) : p.stockTotal === 0 ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-900">Sin stock</span>
                  ) : (
                    <span className={p.stockTotal <= props.pocasUnidades ? "text-amber-800" : "text-neutral-600"}>
                      {p.stockTotal} unidad(es) en {p.tallas} talla(s)
                      {p.tallasAgotadas > 0 && ` · ${p.tallasAgotadas} agotada(s)`}
                      {p.stockTotal <= props.pocasUnidades && " · pocas unidades"}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/panel/productos/${p.id}`} className={estilos.boton}>Editar</Link>
                <form action={alternarActivo}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="activo" value={String(!p.is_active)} />
                  <button type="submit" className={estilos.boton}>{p.is_active ? "Desactivar" : "Activar"}</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
