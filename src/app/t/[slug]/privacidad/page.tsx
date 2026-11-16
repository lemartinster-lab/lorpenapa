import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cargarCatalogoPublico } from "@/lib/datos/catalogoPublico";

export const metadata: Metadata = { title: "Privacidad de las reservas" };

/**
 * Información básica de protección de datos para quien reserva.
 * Es un texto de partida: cada comercio debería revisarlo con su asesor.
 */
export default function PaginaPrivacidad({ params }: PageProps<"/t/[slug]/privacidad">) {
  return (
    <Suspense fallback={<p className="p-6 text-center text-neutral-500">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: Pick<PageProps<"/t/[slug]/privacidad">, "params">) {
  const { slug } = await params;
  const catalogo = await cargarCatalogoPublico(slug);
  if (!catalogo) notFound();
  const { tienda } = catalogo;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href={`/t/${slug}`} className="text-sm underline">← Volver al catálogo</Link>
      <h1 className="mt-4 text-2xl font-bold">Privacidad de las reservas</h1>
      <dl className="mt-6 flex flex-col gap-4 text-sm leading-relaxed">
        <div>
          <dt className="font-semibold">Responsable</dt>
          <dd>
            {tienda.nombre}
            {tienda.direccion ? `, ${tienda.direccion}` : ""}.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Qué datos y para qué</dt>
          <dd>
            Tu nombre y tu teléfono, únicamente para guardarte el producto reservado, identificarte al recogerlo y, si
            hace falta, avisarte sobre esa reserva. No se usan para publicidad.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Base legal</dt>
          <dd>Tu consentimiento, que das al marcar la casilla antes de reservar.</dd>
        </div>
        <div>
          <dt className="font-semibold">Cuánto tiempo</dt>
          <dd>
            La reserva caduca a las {tienda.horasReserva} horas si no se recoge. Los datos se borran automáticamente 30
            días después de cerrarse la reserva (recogida, cancelada o caducada).
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Quién más los ve</dt>
          <dd>
            Nadie más que la tienda. Se almacenan en servidores de la Unión Europea del proveedor tecnológico del
            servicio, que actúa como encargado del tratamiento.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Tus derechos</dt>
          <dd>
            Puedes pedir a la tienda en cualquier momento acceder a tus datos, corregirlos o borrarlos (y así cancelar la
            reserva). Si no te atienden, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).
          </dd>
        </div>
      </dl>
    </main>
  );
}
