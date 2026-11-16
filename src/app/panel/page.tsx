import { Suspense } from "react";
import { exigirSesion, obtenerTienda } from "@/lib/datos/sesion";

/**
 * Inicio del panel. Provisional (paso 1): confirma que el acceso funciona.
 * En el paso 2 aquí estarán la tienda, el catálogo y las reservas.
 */
export default function InicioPanel() {
  return (
    <Suspense fallback={<p className="text-neutral-500">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  const sesion = await exigirSesion();
  const ctx = await obtenerTienda(sesion);
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">{ctx ? ctx.tienda.name : "Bienvenido a LorpenaPa"}</h1>
      <p className="text-neutral-600">
        Has entrado correctamente. El alta de la tienda, el catálogo y las reservas llegan en el
        siguiente paso.
      </p>
    </section>
  );
}
