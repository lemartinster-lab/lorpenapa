"use client";

import { useActionState } from "react";
import { guardarDatosTienda } from "@/lib/acciones/tienda";
import { ESTADO_INICIAL } from "@/lib/acciones/estado";
import type { FilaTienda } from "@/lib/supabase/tipos";
import { Aviso, estilos } from "../ui";

export function FormularioTienda({ tienda, soloLectura }: { tienda: FilaTienda; soloLectura: boolean }) {
  const [estado, accion, enviando] = useActionState(guardarDatosTienda, ESTADO_INICIAL);

  return (
    <form action={accion} className="mt-6 flex flex-col gap-4">
      <fieldset disabled={soloLectura} className="flex flex-col gap-4">
        <label className={estilos.etiqueta}>
          Nombre
          <input name="nombre" required maxLength={120} defaultValue={tienda.name} className={estilos.campo} />
        </label>
        <label className={estilos.etiqueta}>
          WhatsApp
          <input
            name="whatsapp"
            type="tel"
            inputMode="tel"
            defaultValue={tienda.whatsapp ?? ""}
            placeholder="600 11 22 33"
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          Dirección
          <input
            name="direccion"
            maxLength={200}
            defaultValue={tienda.address ?? ""}
            placeholder="Calle Mayor 12, La Laguna"
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          Horario
          <textarea
            name="horario"
            maxLength={300}
            rows={2}
            defaultValue={tienda.opening_hours ?? ""}
            placeholder={"L-V 10:00-14:00 y 17:00-20:30\nS 10:00-14:00"}
            className={estilos.campo}
          />
        </label>
        <label className={estilos.etiqueta}>
          Cuánto se guarda una reserva (horas)
          <input
            name="horas_reserva"
            type="number"
            min={1}
            max={168}
            required
            defaultValue={tienda.reservation_hours}
            className={`${estilos.campo} w-32`}
          />
          <span className="text-xs font-normal text-neutral-500">
            Pasado ese tiempo sin recogerla, la unidad vuelve a estar disponible sola.
          </span>
        </label>
      </fieldset>

      <Aviso estado={estado} />
      {!soloLectura && (
        <button type="submit" disabled={enviando} className={`${estilos.principal} self-start`}>
          {enviando ? "Guardando…" : "Guardar"}
        </button>
      )}
    </form>
  );
}
