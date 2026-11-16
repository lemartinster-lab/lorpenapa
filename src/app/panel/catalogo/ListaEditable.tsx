"use client";

import { useActionState, useState } from "react";
import {
  borrarCategoria,
  borrarMarca,
  crearCategoria,
  crearMarca,
  moverCategoria,
  renombrarCategoria,
  renombrarMarca,
} from "@/lib/acciones/catalogo";
import { ESTADO_INICIAL } from "@/lib/acciones/estado";
import { Aviso, BotonBorrar, estilos, useCerrarAlTerminar } from "../ui";

type Elemento = { id: string; name: string };

const ACCIONES = {
  categoria: { crear: crearCategoria, renombrar: renombrarCategoria, borrar: borrarCategoria },
  marca: { crear: crearMarca, renombrar: renombrarMarca, borrar: borrarMarca },
};

/** Lista de categorías o marcas: añadir, renombrar, borrar (y ordenar categorías). */
export function ListaEditable(props: {
  tipo: "categoria" | "marca";
  titulo: string;
  ejemplo: string;
  elementos: Elemento[];
}) {
  const acciones = ACCIONES[props.tipo];
  const [estado, accion, enviando] = useActionState(acciones.crear, ESTADO_INICIAL);

  return (
    <article className="rounded-xl border border-neutral-200 bg-white">
      <h2 className="border-b border-neutral-100 p-4 text-lg font-semibold">{props.titulo}</h2>
      {props.elementos.length === 0 ? (
        <p className="p-4 text-sm text-neutral-500">Todavía no hay ninguna.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {props.elementos.map((e, i) => (
            <Fila
              key={e.id}
              elemento={e}
              tipo={props.tipo}
              esPrimera={i === 0}
              esUltima={i === props.elementos.length - 1}
            />
          ))}
        </ul>
      )}
      <form action={accion} className="flex flex-col gap-2 border-t border-neutral-100 p-4">
        <div className="flex gap-2">
          <input
            name="nombre"
            required
            maxLength={80}
            placeholder={props.ejemplo}
            aria-label={`Nueva ${props.tipo === "marca" ? "marca" : "categoría"}`}
            className={`${estilos.campo} min-w-0 flex-1`}
          />
          <button type="submit" disabled={enviando} className={estilos.principal}>
            Añadir
          </button>
        </div>
        <Aviso estado={estado} />
      </form>
    </article>
  );
}

function Fila(props: { elemento: Elemento; tipo: "categoria" | "marca"; esPrimera: boolean; esUltima: boolean }) {
  const acciones = ACCIONES[props.tipo];
  const [editando, setEditando] = useState(false);
  const [estado, accion, enviando] = useActionState(acciones.renombrar, ESTADO_INICIAL);
  useCerrarAlTerminar(estado, () => setEditando(false));

  if (editando) {
    return (
      <li className="p-3">
        <form action={accion} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={props.elemento.id} />
          <div className="flex gap-2">
            <input
              name="nombre"
              defaultValue={props.elemento.name}
              required
              maxLength={80}
              aria-label="Nuevo nombre"
              className={`${estilos.campo} min-w-0 flex-1`}
            />
            <button type="submit" disabled={enviando} className={estilos.boton}>Guardar</button>
            <button type="button" onClick={() => setEditando(false)} className={estilos.boton}>Cancelar</button>
          </div>
          <Aviso estado={estado} />
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3">
      <span>{props.elemento.name}</span>
      <div className="flex flex-wrap gap-1">
        {props.tipo === "categoria" && (
          <>
            <form action={moverCategoria}>
              <input type="hidden" name="id" value={props.elemento.id} />
              <input type="hidden" name="direccion" value="arriba" />
              <button type="submit" disabled={props.esPrimera} className={estilos.boton} aria-label="Subir">↑</button>
            </form>
            <form action={moverCategoria}>
              <input type="hidden" name="id" value={props.elemento.id} />
              <input type="hidden" name="direccion" value="abajo" />
              <button type="submit" disabled={props.esUltima} className={estilos.boton} aria-label="Bajar">↓</button>
            </form>
          </>
        )}
        <button type="button" onClick={() => setEditando(true)} className={estilos.boton}>Renombrar</button>
        <BotonBorrar accion={acciones.borrar} id={props.elemento.id} pregunta="¿Borrar?" />
      </div>
    </li>
  );
}
