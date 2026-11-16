"use client";

import { useActionState, useState } from "react";
import { crearTienda } from "@/lib/acciones/tienda";
import { ESTADO_INICIAL } from "@/lib/acciones/estado";
import { generarSlug } from "@/lib/domain/slug";
import { Aviso, estilos } from "../ui";

export function FormularioNueva() {
  const [estado, accion, enviando] = useActionState(crearTienda, ESTADO_INICIAL);
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const slugMostrado = slugTocado ? slug : generarSlug(nombre);

  return (
    <form action={accion} className="mt-6 flex flex-col gap-4">
      <label className={estilos.etiqueta}>
        Nombre de la tienda
        <input
          name="nombre"
          required
          maxLength={120}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Kirolak Beñat"
          className={estilos.campo}
        />
      </label>

      <label className={estilos.etiqueta}>
        Dirección de tu catálogo
        <span className="flex items-center rounded-md border border-neutral-300">
          <span className="pl-3 text-sm font-normal text-neutral-500">lorpenapa…/t/</span>
          <input
            name="slug"
            value={slugMostrado}
            onChange={(e) => {
              setSlugTocado(true);
              setSlug(e.target.value);
            }}
            className="min-w-0 flex-1 rounded-md px-1 py-2"
          />
        </span>
        <span className="text-xs font-normal text-neutral-500">Es la que llevará el QR de tu escaparate.</span>
      </label>

      <label className={estilos.etiqueta}>
        <span>
          WhatsApp de la tienda <span className="font-normal text-neutral-500">(opcional)</span>
        </span>
        <input name="whatsapp" type="tel" inputMode="tel" placeholder="600 11 22 33" className={estilos.campo} />
        <span className="text-xs font-normal text-neutral-500">
          Para contestar a las reservas de tus clientes con un toque.
        </span>
      </label>

      <Aviso estado={estado} />
      <button type="submit" disabled={enviando} className={estilos.principal}>
        {enviando ? "Creando…" : "Crear tienda"}
      </button>
    </form>
  );
}
