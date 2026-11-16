import { Suspense } from "react";
import { redirect } from "next/navigation";
import { exigirTienda } from "@/lib/datos/sesion";

/** /panel → productos (o al alta de la tienda si aún no hay). */
export default function InicioPanel() {
  return (
    <Suspense fallback={<p className="text-neutral-500">Cargando…</p>}>
      <Redirigir />
    </Suspense>
  );
}

async function Redirigir(): Promise<null> {
  await exigirTienda(); // sin tienda → /panel/nueva
  redirect("/panel/productos");
}
