"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { reservar, type EstadoReservaPublica } from "@/lib/acciones/reservas";
import type { CatalogoPublico, TallaPublica } from "@/lib/domain/catalogoPublico";
import { enlaceWhatsApp, mensajeClienteATienda } from "@/lib/domain/whatsapp";

const INICIAL: EstadoReservaPublica = { ok: false };
const campo = "rounded-md border border-neutral-300 px-3 py-2";

const etiquetaTalla = (t: TallaPublica) => `${t.talla}${t.color ? ` · ${t.color}` : ""}`;

/** Elegir talla + "Resérvalo y recógelo" (nombre, teléfono y consentimiento). */
export function FormularioReserva(props: {
  slug: string;
  tienda: CatalogoPublico["tienda"];
  producto: { nombre: string; tallas: TallaPublica[] };
}) {
  const [estado, accion, enviando] = useActionState(reservar, INICIAL);
  const [elegida, setElegida] = useState<TallaPublica | null>(null);

  if (estado.ok) return <Confirmacion estado={estado} tienda={props.tienda} producto={props.producto.nombre} />;

  return (
    <form action={accion} className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-xl font-bold">Resérvalo y recógelo en tienda</h2>
      <p className="-mt-3 text-sm text-neutral-600">
        Sin pagar ahora: te lo guardamos {props.tienda.horasReserva} horas y lo pagas al recogerlo.
      </p>

      <input type="hidden" name="tienda" value={props.slug} />
      <input type="hidden" name="nombre_talla" value={elegida ? etiquetaTalla(elegida) : ""} />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Elige tu talla</legend>
        <div className="flex flex-wrap gap-2">
          {props.producto.tallas.map((t) => {
            const agotada = t.estado === "agotada";
            return (
              <label
                key={t.id}
                className={`cursor-pointer rounded-lg border-2 px-4 py-2 text-sm font-semibold has-checked:border-neutral-900 has-checked:bg-neutral-900 has-checked:text-white ${
                  agotada ? "cursor-not-allowed border-neutral-200 text-neutral-300 line-through" : "border-neutral-300"
                }`}
              >
                <input
                  type="radio"
                  name="talla"
                  value={t.id}
                  disabled={agotada}
                  required
                  onChange={() => setElegida(t)}
                  className="sr-only"
                />
                {etiquetaTalla(t)}
                {t.estado === "ultimas" && <span className="ml-1 text-xs font-normal">· últimas</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tu nombre
          <input name="nombre" required minLength={2} maxLength={80} autoComplete="name" className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tu teléfono
          <input name="telefono" type="tel" required inputMode="tel" autoComplete="tel" placeholder="600 11 22 33" className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Unidades
          <select name="cantidad" defaultValue="1" className={campo}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Campo trampa: invisible para personas; los bots lo rellenan */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Web
          <input name="web" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consentimiento" required className="mt-1" />
        <span>
          Acepto que <strong>{props.tienda.nombre}</strong> use mi nombre y teléfono únicamente para gestionar esta
          reserva y avisarme. Se borran automáticamente 30 días después de cerrarla.{" "}
          <Link href={`/t/${props.slug}/privacidad`} target="_blank" className="underline">
            Más información
          </Link>
        </span>
      </label>

      {!estado.ok && estado.error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{estado.error}</p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-neutral-900 px-5 py-3 font-semibold text-white disabled:opacity-60"
      >
        {enviando ? "Reservando…" : "Reservar"}
      </button>
    </form>
  );
}

function Confirmacion(props: {
  estado: Extract<EstadoReservaPublica, { ok: true }>;
  tienda: CatalogoPublico["tienda"];
  producto: string;
}) {
  const { estado, tienda } = props;
  const hasta = new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeStyle: "short" }).format(new Date(estado.caduca));
  const [talla, color] = estado.talla.split(" · ");
  const whatsapp = tienda.whatsapp
    ? enlaceWhatsApp(
        tienda.whatsapp,
        mensajeClienteATienda({
          codigo: estado.codigo,
          producto: props.producto,
          talla,
          color: color ?? null,
          cantidad: estado.cantidad,
          tienda: tienda.nombre,
        }),
      )
    : null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-green-600 bg-green-50 p-5" role="status">
      <h2 className="text-xl font-bold text-green-900">✓ ¡Reservado!</h2>
      <p>
        Tu código de reserva es{" "}
        <strong className="rounded bg-white px-2 py-1 font-mono text-2xl tracking-widest">{estado.codigo}</strong>
      </p>
      <p className="text-sm">
        {props.producto} · talla {estado.talla}
        {estado.cantidad > 1 ? ` · ${estado.cantidad} unidades` : ""}
      </p>
      <p className="text-sm">
        Te lo guardamos hasta el <strong>{hasta}</strong>. Enseña el código al recogerlo y paga en tienda.
      </p>
      {tienda.direccion && <p className="text-sm">📍 {tienda.direccion}</p>}
      <p className="text-xs text-neutral-600">Haz una captura de esta pantalla para no perder el código.</p>
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Avisar a la tienda por WhatsApp
        </a>
      )}
    </section>
  );
}
