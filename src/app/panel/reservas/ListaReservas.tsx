"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { cancelarReserva, confirmarReserva, entregarReserva } from "@/lib/acciones/reservas";
import { ESTADO_INICIAL, type EstadoAccion } from "@/lib/acciones/estado";
import type { ReservaPanel } from "@/lib/datos/reservas";
import { enlaceWhatsApp, mensajeTiendaACliente } from "@/lib/domain/whatsapp";
import { estilos } from "../ui";

type Vista = "activas" | "cerradas";

const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

const ETIQUETA: Record<ReservaPanel["estado"], string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  collected: "Entregada",
  cancelled: "Cancelada",
};

export function ListaReservas({ reservas, tienda }: { reservas: ReservaPanel[]; tienda: string }) {
  const [vista, setVista] = useState<Vista>("activas");
  const activas = reservas.filter((r) => (r.estado === "pending" || r.estado === "confirmed") && !r.caducada);
  const cerradas = reservas.filter((r) => !activas.includes(r));
  const lista = vista === "activas" ? activas : cerradas;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex gap-2" role="tablist">
        {(
          [
            ["activas", `Activas (${activas.length})`],
            ["cerradas", `Cerradas y caducadas (${cerradas.length})`],
          ] as const
        ).map(([v, texto]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            onClick={() => setVista(v)}
            className={`rounded-full border px-4 py-1.5 text-sm ${vista === v ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-neutral-600">
          {vista === "activas"
            ? "No hay reservas activas. Cuando un cliente reserve desde tu catálogo, aparecerá aquí."
            : "No hay reservas cerradas en los últimos 30 días."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((r) => (
            <Tarjeta key={r.id} reserva={r} tienda={tienda} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Tarjeta({ reserva: r, tienda }: { reserva: ReservaPanel; tienda: string }) {
  const activa = (r.estado === "pending" || r.estado === "confirmed") && !r.caducada;
  const datos = {
    nombreCliente: r.cliente,
    codigo: r.codigo,
    producto: r.producto,
    talla: r.talla,
    color: r.color,
    cantidad: r.cantidad,
    tienda,
  };
  const wa = (tipo: "lista" | "confirmada" | "cancelada") => enlaceWhatsApp(r.telefono, mensajeTiendaACliente(datos, tipo));

  return (
    <li
      className={`rounded-xl border bg-white p-4 ${
        r.estado === "pending" && activa ? "border-amber-400" : "border-neutral-200"
      } ${activa ? "" : "opacity-75"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono font-bold tracking-wider">{r.codigo}</span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                r.caducada
                  ? "bg-neutral-200 text-neutral-700"
                  : r.estado === "pending"
                    ? "bg-amber-100 text-amber-900"
                    : r.estado === "confirmed"
                      ? "bg-blue-100 text-blue-900"
                      : r.estado === "collected"
                        ? "bg-green-100 text-green-900"
                        : "bg-red-100 text-red-900"
              }`}
            >
              {r.caducada ? "Caducada" : ETIQUETA[r.estado]}
            </span>
          </p>
          <p className="mt-2 font-semibold">
            {r.productoId ? (
              <Link href={`/panel/productos/${r.productoId}`} className="hover:underline">{r.producto}</Link>
            ) : (
              r.producto
            )}{" "}
            · talla {r.talla}
            {r.color ? ` (${r.color})` : ""}
            {r.cantidad > 1 ? ` · ${r.cantidad} uds.` : ""}
          </p>
          <p className="text-sm text-neutral-700">
            {r.cliente} · <a href={`tel:${r.telefono}`} className="underline">{r.telefono}</a>
          </p>
          {/* La hora se formatea en la zona del navegador; puede diferir de la del servidor */}
          <p className="mt-1 text-xs text-neutral-500" suppressHydrationWarning>
            Reservada {fecha(r.creada)} ·{" "}
            {activa ? `caduca ${fecha(r.caduca)}` : r.cerrada ? `cerrada ${fecha(r.cerrada)}` : `caducó ${fecha(r.caduca)}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-2">
        {activa && (
          <>
            {r.estado === "pending" && <BotonAccion accion={confirmarReserva} id={r.id} texto="Confirmar" />}
            <BotonAccion accion={entregarReserva} id={r.id} texto="Entregada" principal />
            <BotonAccion accion={cancelarReserva} id={r.id} texto="Cancelar" peligro pregunta="¿Cancelar esta reserva?" />
          </>
        )}
        {/* Una reserva caducada puede entregarse igual si el cliente aparece y la talla sigue ahí */}
        {r.caducada && (r.estado === "pending" || r.estado === "confirmed") && (
          <BotonAccion accion={entregarReserva} id={r.id} texto="Entregar igualmente" />
        )}
      </div>

      {activa && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3 text-sm">
          <span className="text-neutral-500">WhatsApp:</span>
          {r.estado === "pending" && <EnlaceWA href={wa("confirmada")} texto="«La hemos recibido»" />}
          <EnlaceWA href={wa("lista")} texto="«Ya está lista»" />
          <EnlaceWA href={wa("cancelada")} texto="«Hemos tenido que cancelarla»" />
        </div>
      )}
    </li>
  );
}

function EnlaceWA({ href, texto }: { href: string | null; texto: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-green-600 px-3 py-0.5 text-green-800 hover:bg-green-50">
      {texto}
    </a>
  );
}

function BotonAccion(props: {
  accion: (p: EstadoAccion, fd: FormData) => Promise<EstadoAccion>;
  id: string;
  texto: string;
  principal?: boolean;
  peligro?: boolean;
  pregunta?: string;
}) {
  const [estado, accion, enviando] = useActionState(props.accion, ESTADO_INICIAL);
  const [confirmando, setConfirmando] = useState(false);
  const clase = props.principal
    ? "rounded-md bg-green-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-60"
    : `${estilos.boton} ${props.peligro ? "text-red-700" : ""}`;

  if (props.pregunta && !confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className={clase}>
        {props.texto}
      </button>
    );
  }
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={props.id} />
      {props.pregunta && <span className="text-sm text-red-700">{props.pregunta}</span>}
      <button type="submit" disabled={enviando} className={props.pregunta ? "rounded-md bg-red-700 px-3 py-1 text-sm text-white" : clase}>
        {enviando ? "…" : props.pregunta ? "Sí, cancelar" : props.texto}
      </button>
      {props.pregunta && (
        <button type="button" onClick={() => setConfirmando(false)} className={estilos.boton}>No</button>
      )}
      {estado.error && <span className="basis-full text-sm text-red-700" role="alert">{estado.error}</span>}
    </form>
  );
}
