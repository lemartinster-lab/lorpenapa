import Link from "next/link";
import type { CatalogoPublico } from "@/lib/domain/catalogoPublico";
import { enlaceWhatsApp } from "@/lib/domain/whatsapp";

/** Cabecera común del catálogo y de la ficha: nombre, dirección, horario y WhatsApp. */
export function CabeceraTienda({ tienda }: { tienda: CatalogoPublico["tienda"] }) {
  const whatsapp = tienda.whatsapp ? enlaceWhatsApp(tienda.whatsapp) : null;
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 py-6">
      <div>
        <Link href={`/t/${tienda.slug}`} className="text-3xl font-bold tracking-tight hover:underline">
          {tienda.nombre}
        </Link>
        {tienda.direccion && <p className="mt-1 text-sm text-neutral-600">📍 {tienda.direccion}</p>}
        {tienda.horario && <p className="text-sm whitespace-pre-line text-neutral-600">🕒 {tienda.horario}</p>}
      </div>
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          WhatsApp
        </a>
      )}
    </header>
  );
}
