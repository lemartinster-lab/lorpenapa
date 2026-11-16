"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cambiarPublicacion } from "@/lib/acciones/tienda";
import { ESTADO_INICIAL } from "@/lib/acciones/estado";
import { Aviso, estilos } from "../ui";

/** Barra con el estado del catálogo: publicado o en borrador. */
export function EstadoPublicacion(props: { slug: string; publicada: boolean; esPropietario: boolean; hayProductos: boolean }) {
  const [estado, accion, enviando] = useActionState(cambiarPublicacion, ESTADO_INICIAL);

  return (
    <div
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
        props.publicada ? "border-green-300 bg-green-50" : "border-neutral-300 bg-neutral-50"
      }`}
    >
      <div className="text-sm">
        {props.publicada ? (
          <p>
            <strong className="text-green-900">● Catálogo publicado.</strong> Tus clientes lo ven en{" "}
            <Link href={`/t/${props.slug}`} target="_blank" className="font-mono underline">/t/{props.slug}</Link>
          </p>
        ) : (
          <p>
            <strong>○ Borrador.</strong> Nadie más ve tu catálogo ni puede reservar hasta que lo publiques.
          </p>
        )}
        <Aviso estado={estado} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/panel/qr" className={estilos.boton}>Código QR</Link>
        {props.publicada && (
          <Link href={`/t/${props.slug}`} target="_blank" className={estilos.boton}>Ver catálogo ↗</Link>
        )}
        {props.esPropietario && (
          <form action={accion}>
            <input type="hidden" name="publicar" value={String(!props.publicada)} />
            <button
              type="submit"
              disabled={enviando || (!props.publicada && !props.hayProductos)}
              title={!props.publicada && !props.hayProductos ? "Añade al menos un producto con tallas antes de publicar" : undefined}
              className={
                props.publicada
                  ? estilos.boton
                  : "rounded-md bg-green-700 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
              }
            >
              {enviando ? "…" : props.publicada ? "Retirar catálogo" : "Publicar tienda"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
