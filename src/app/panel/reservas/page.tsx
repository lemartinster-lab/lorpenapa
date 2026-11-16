import type { Metadata } from "next";
import { Suspense } from "react";
import { exigirTienda } from "@/lib/datos/sesion";
import { cargarReservas } from "@/lib/datos/reservas";
import { ListaReservas } from "./ListaReservas";

export const metadata: Metadata = { title: "Reservas · LorpenaPa" };

export default function PaginaReservas() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Reservas</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Al entregar una reserva se descuenta el stock. Las cerradas se borran solas a los 30 días.
      </p>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </section>
  );
}

async function Contenido() {
  const ctx = await exigirTienda();
  const reservas = await cargarReservas(ctx);
  return <ListaReservas reservas={reservas} tienda={ctx.tienda.name} />;
}
