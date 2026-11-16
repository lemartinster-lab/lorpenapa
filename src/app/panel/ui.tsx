"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/acciones/estado";

/** Estilos compartidos del panel. */
export const estilos = {
  boton: "rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-50 disabled:opacity-50",
  principal: "rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60",
  campo: "rounded-md border border-neutral-300 px-3 py-2",
  etiqueta: "flex flex-col gap-1 text-sm font-medium",
};

const SEGUNDOS_AVISO_OK = 4;

/**
 * Mensaje bajo un formulario. Los errores se quedan hasta el siguiente
 * intento; los mensajes de éxito desaparecen a los pocos segundos.
 */
export function Aviso({ estado }: { estado: EstadoAccion }) {
  // Guardamos QUÉ respuesta se ocultó: una respuesta nueva es otro objeto y vuelve a verse
  const [ocultado, setOcultado] = useState<EstadoAccion | null>(null);
  useEffect(() => {
    if (!estado.ok || !estado.mensaje) return;
    const t = setTimeout(() => setOcultado(estado), SEGUNDOS_AVISO_OK * 1000);
    return () => clearTimeout(t);
  }, [estado]);

  if (estado.error) return <p className="text-sm text-red-700" role="alert">{estado.error}</p>;
  if (estado.ok && estado.mensaje && ocultado !== estado) {
    return <p className="text-sm text-green-800" role="status">{estado.mensaje}</p>;
  }
  return null;
}

/** Ejecuta `cerrar` cuando LLEGA un resultado correcto nuevo. */
export function useCerrarAlTerminar(estado: EstadoAccion, cerrar: () => void) {
  const ref = useRef(cerrar);
  useEffect(() => {
    ref.current = cerrar;
  });
  useEffect(() => {
    if (estado.ok) ref.current();
  }, [estado]);
}

/** Borrado en dos pasos, sin diálogos del navegador. Para acciones sin estado. */
export function BotonBorrar(props: {
  accion: (fd: FormData) => Promise<void>;
  id: string;
  texto?: string;
  pregunta: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className={`${estilos.boton} text-red-700`}>
        {props.texto ?? "Borrar"}
      </button>
    );
  }
  return (
    <form action={props.accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={props.id} />
      <span className="text-sm text-red-700">{props.pregunta}</span>
      <button type="submit" className="rounded-md bg-red-700 px-3 py-1 text-sm text-white">Sí, borrar</button>
      <button type="button" onClick={() => setConfirmando(false)} className={estilos.boton}>No</button>
    </form>
  );
}

/** Borrado en dos pasos para acciones que pueden fallar con un mensaje (p. ej. reservas activas). */
export function BotonBorrarConAviso(props: {
  accion: (p: EstadoAccion, fd: FormData) => Promise<EstadoAccion>;
  campos: Record<string, string>;
  texto?: string;
  pregunta: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, accion, enviando] = useActionState(props.accion, ESTADO_INICIAL);

  return (
    <div className="flex flex-col gap-1">
      {!confirmando ? (
        <button type="button" onClick={() => setConfirmando(true)} className={`${estilos.boton} text-red-700`}>
          {props.texto ?? "Borrar"}
        </button>
      ) : (
        <form action={accion} className="flex flex-wrap items-center gap-2">
          {Object.entries(props.campos).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <span className="text-sm text-red-700">{props.pregunta}</span>
          <button type="submit" disabled={enviando} className="rounded-md bg-red-700 px-3 py-1 text-sm text-white">
            Sí, borrar
          </button>
          <button type="button" onClick={() => setConfirmando(false)} className={estilos.boton}>No</button>
        </form>
      )}
      {estado.error && <p className="text-sm text-red-700" role="alert">{estado.error}</p>}
    </div>
  );
}

const PESTANAS = [
  { href: "/panel/reservas", texto: "Reservas" },
  { href: "/panel/productos", texto: "Productos" },
  { href: "/panel/catalogo", texto: "Categorías y marcas" },
  { href: "/panel/tienda", texto: "Tienda" },
] as const;

/** Pestañas del panel. `pendientes` se muestra como contador en «Reservas». */
export function Pestanas({ pendientes = 0 }: { pendientes?: number }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="flex gap-1 overflow-x-auto">
      {PESTANAS.map((p) => {
        const activa = ruta.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={`shrink-0 rounded-t-md border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
              activa ? "border-neutral-900 font-semibold" : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {p.texto}
            {p.href === "/panel/reservas" && pendientes > 0 && (
              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white" aria-label={`${pendientes} pendientes`}>
                {pendientes}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
