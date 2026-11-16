"use client";

import { useActionState, useState } from "react";
import { ajustarStock, anadirTallas, borrarVariante, guardarVariante } from "@/lib/acciones/productos";
import { ESTADO_INICIAL } from "@/lib/acciones/estado";
import { expandirTallas } from "@/lib/domain/tallas";
import type { VarianteConReservas } from "@/lib/datos/catalogo";
import { Aviso, BotonBorrarConAviso, estilos, useCerrarAlTerminar } from "../../ui";

/** Tabla de tallas: stock con +1/−1 y edición de cada fila. */
export function TablaTallas({ variantes }: { variantes: VarianteConReservas[] }) {
  if (variantes.length === 0) {
    return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Este producto todavía no tiene tallas.</p>;
  }
  const total = variantes.reduce((n, v) => n + v.stock, 0);
  const reservadas = variantes.reduce((n, v) => n + v.reservadas, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-600">
          <tr>
            <th scope="col" className="px-3 py-2">Talla</th>
            <th scope="col" className="px-3 py-2">Color</th>
            <th scope="col" className="px-3 py-2">Stock</th>
            <th scope="col" className="px-3 py-2">Reservadas</th>
            <th scope="col" className="px-3 py-2"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {variantes.map((v) => (
            <Fila key={v.id} variante={v} />
          ))}
        </tbody>
        <tfoot className="bg-neutral-50 text-neutral-600">
          <tr>
            <td colSpan={2} className="px-3 py-2">Total</td>
            <td className="px-3 py-2 font-semibold tabular-nums">{total}</td>
            <td className="px-3 py-2 tabular-nums">{reservadas}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Fila({ variante: v }: { variante: VarianteConReservas }) {
  const [editando, setEditando] = useState(false);
  const [estado, accion, enviando] = useActionState(guardarVariante, ESTADO_INICIAL);
  // Tras guardar bien, se vuelve a la vista normal (solo con cada respuesta nueva)
  useCerrarAlTerminar(estado, () => setEditando(false));

  if (editando) {
    return (
      <tr>
        <td colSpan={5} className="px-3 py-3">
          <form action={accion} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={v.id} />
            <label className={estilos.etiqueta}>
              Talla
              <input name="talla" required maxLength={20} defaultValue={v.size} className={`${estilos.campo} w-24`} />
            </label>
            <label className={estilos.etiqueta}>
              Color
              <input name="color" maxLength={40} defaultValue={v.color ?? ""} className={`${estilos.campo} w-32`} />
            </label>
            <label className={estilos.etiqueta}>
              Referencia
              <input name="referencia" maxLength={60} defaultValue={v.sku ?? ""} className={`${estilos.campo} w-36`} />
            </label>
            <label className={estilos.etiqueta}>
              Stock
              <input name="stock" type="number" min={0} max={100000} defaultValue={v.stock} className={`${estilos.campo} w-24`} />
            </label>
            <button type="submit" disabled={enviando} className={estilos.principal}>Guardar</button>
            <button type="button" onClick={() => setEditando(false)} className={estilos.boton}>Cancelar</button>
            <div className="basis-full">
              <Aviso estado={estado} />
            </div>
          </form>
        </td>
      </tr>
    );
  }

  const disponibles = Math.max(v.stock - v.reservadas, 0);
  return (
    <tr className={v.stock === 0 ? "bg-red-50/50" : ""}>
      <td className="px-3 py-2 font-semibold">{v.size}</td>
      <td className="px-3 py-2">{v.color ?? <span className="text-neutral-400">—</span>}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <form action={ajustarStock}>
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="delta" value="-1" />
            <button type="submit" disabled={v.stock === 0} className={estilos.boton} aria-label={`Quitar una unidad de la talla ${v.size}`}>
              −1
            </button>
          </form>
          <span className="w-10 text-center font-semibold tabular-nums">{v.stock}</span>
          <form action={ajustarStock}>
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="delta" value="1" />
            <button type="submit" className={estilos.boton} aria-label={`Añadir una unidad a la talla ${v.size}`}>
              +1
            </button>
          </form>
        </div>
      </td>
      <td className="px-3 py-2 text-neutral-600">
        {v.reservadas > 0 ? (
          <span title={`Disponibles para reservar: ${disponibles}`}>
            {v.reservadas} <span className="text-xs">(quedan {disponibles})</span>
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap justify-end gap-1">
          <button type="button" onClick={() => setEditando(true)} className={estilos.boton}>Editar</button>
          <BotonBorrarConAviso
            accion={borrarVariante}
            campos={{ id: v.id }}
            pregunta={`¿Borrar la talla ${v.size}?`}
          />
        </div>
      </td>
    </tr>
  );
}

/** "Añadir tallas en bloque" con vista previa de lo que se va a crear. */
export function AnadirTallas({ productoId }: { productoId: string }) {
  const [estado, accion, enviando] = useActionState(anadirTallas, ESTADO_INICIAL);
  const [texto, setTexto] = useState("");
  const previa = texto.trim() ? expandirTallas(texto) : null;

  return (
    <form action={accion} className="flex flex-col gap-3 rounded-xl border border-dashed border-neutral-300 p-4">
      <input type="hidden" name="producto" value={productoId} />
      <p className="font-semibold">Añadir tallas en bloque</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className={estilos.etiqueta}>
          Tallas
          <input
            name="tallas"
            required
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="38-46   ·   S, M, L, XL   ·   Única"
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          <span>
            Color <span className="font-normal text-neutral-500">(opcional)</span>
          </span>
          <input name="color" maxLength={40} placeholder="Negro" className={estilos.campo} />
        </label>
      </div>
      {previa && (
        <p className={`text-sm ${previa.ok ? "text-neutral-700" : "text-red-700"}`}>
          {previa.ok ? `Se crearán ${previa.tallas.length}: ${previa.tallas.join(" · ")}` : previa.error}
        </p>
      )}
      <Aviso estado={estado} />
      <button type="submit" disabled={enviando || (previa !== null && !previa.ok)} className={`${estilos.principal} self-start`}>
        {enviando ? "Añadiendo…" : "Añadir tallas"}
      </button>
    </form>
  );
}
