"use client";

import { useActionState, useState } from "react";
import { crearProducto, guardarProducto } from "@/lib/acciones/productos";
import { ESTADO_INICIAL } from "@/lib/acciones/estado";
import { parsearPrecio, porcentajeDescuento } from "@/lib/domain/precio";
import type { FilaProducto } from "@/lib/supabase/tipos";
import { Aviso, estilos } from "../ui";

type Opcion = { id: string; nombre: string };

const aTexto = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

/** Alta (sin `producto`) o edición (con `producto`) de los datos de un producto. */
export function FormularioProducto(props: { producto?: FilaProducto; categorias: Opcion[]; marcas: Opcion[] }) {
  const { producto } = props;
  const [estado, accion, enviando] = useActionState(producto ? guardarProducto : crearProducto, ESTADO_INICIAL);
  const [precio, setPrecio] = useState(aTexto(producto?.price_cents ?? null));
  const [oferta, setOferta] = useState(aTexto(producto?.sale_price_cents ?? null));

  // "-X %" en vivo mientras se escribe
  const p = parsearPrecio(precio);
  const o = oferta ? parsearPrecio(oferta) : null;
  const descuento = p !== null ? porcentajeDescuento(p, o) : null;
  const ofertaInvalida = p !== null && o !== null && o >= p;

  return (
    <form action={accion} className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      {producto && <input type="hidden" name="id" value={producto.id} />}

      <label className={estilos.etiqueta}>
        Nombre
        <input name="nombre" required maxLength={160} defaultValue={producto?.name} placeholder="Chaleco térmico" className={estilos.campo} />
      </label>

      <label className={estilos.etiqueta}>
        <span>
          Descripción <span className="font-normal text-neutral-500">(opcional)</span>
        </span>
        <textarea name="descripcion" maxLength={2000} rows={3} defaultValue={producto?.description ?? ""} className={estilos.campo} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={estilos.etiqueta}>
          Categoría
          <select name="categoria" defaultValue={producto?.category_id ?? ""} className={estilos.campo}>
            <option value="">Sin categoría</option>
            {props.categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label className={estilos.etiqueta}>
          Marca
          <select name="marca" defaultValue={producto?.brand_id ?? ""} className={estilos.campo}>
            <option value="">Sin marca</option>
            {props.marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={estilos.etiqueta}>
          Precio (€)
          <input
            name="precio"
            required
            inputMode="decimal"
            placeholder="65,00"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          <span>
            Precio de oferta (€) <span className="font-normal text-neutral-500">(opcional)</span>
          </span>
          <input
            name="oferta"
            inputMode="decimal"
            placeholder="61,75"
            value={oferta}
            onChange={(e) => setOferta(e.target.value)}
            aria-invalid={ofertaInvalida}
            className={`${estilos.campo} ${ofertaInvalida ? "border-red-500" : ""}`}
          />
          {ofertaInvalida ? (
            <span className="text-xs font-normal text-red-700">Tiene que ser menor que el precio normal.</span>
          ) : descuento !== null ? (
            <span className="text-xs font-normal text-green-800">Se mostrará como «-{descuento} %».</span>
          ) : null}
        </label>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="activo" defaultChecked={producto?.is_active ?? true} /> Activo (visible en el catálogo)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="nuevo" defaultChecked={producto?.is_new ?? false} /> Marcar como «NUEVO»
        </label>
      </div>

      <Aviso estado={estado} />
      <button type="submit" disabled={enviando || ofertaInvalida} className={`${estilos.principal} self-start`}>
        {enviando ? "Guardando…" : producto ? "Guardar cambios" : "Crear y añadir tallas →"}
      </button>
    </form>
  );
}
