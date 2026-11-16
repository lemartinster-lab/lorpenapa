import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import QRCode from "qrcode";
import { exigirTienda } from "@/lib/datos/sesion";
import { origenDelSitio } from "@/lib/datos/origen";
import { BotonImprimir } from "./BotonImprimir";

export const metadata: Metadata = { title: "Código QR · LorpenaPa" };

export default function PaginaQR() {
  return (
    <section>
      <div className="print:hidden">
        <Link href="/panel/productos" className="text-sm underline">← Productos</Link>
        <h1 className="mt-2 text-2xl font-bold">Código QR para tu escaparate</h1>
      </div>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Generando el código…</p>}>
        <Contenido />
      </Suspense>
    </section>
  );
}

async function Contenido() {
  const { tienda } = await exigirTienda();
  const url = `${await origenDelSitio()}/t/${tienda.slug}`;
  const local = /localhost|127\.0\.0\.1/.test(url);

  // Corrección de errores "M": aguanta reflejos o arañazos en el cristal
  const opciones = { errorCorrectionLevel: "M" as const, margin: 2 };
  const svg = await QRCode.toString(url, { ...opciones, type: "svg" });
  const png = await QRCode.toDataURL(url, { ...opciones, width: 1024 });
  const svgDescarga = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-col gap-3 print:hidden">
        {!tienda.is_published && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            ⚠ Tu catálogo está en <strong>borrador</strong>: quien escanee verá «No disponible» hasta que lo publiques
            desde la pestaña Productos.
          </p>
        )}
        {local && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            ℹ Estás en modo local: el código apunta a <span className="font-mono">{url}</span>, que solo funciona en este
            ordenador. Cuando la app esté publicada en Internet apuntará a la dirección definitiva. No lo imprimas todavía.
          </p>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border-2 border-neutral-900 p-6 text-center print:max-w-none print:border-0">
        <p className="text-2xl font-bold">{tienda.name}</p>
        <div
          className="w-full max-w-[16rem] [&>svg]:h-auto [&>svg]:w-full"
          role="img"
          aria-label={`Código QR que abre ${url}`}
          // SVG generado por la librería qrcode a partir de nuestra propia URL
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="text-lg font-semibold">Mira nuestro catálogo</p>
        <p className="text-sm text-neutral-600">Tallas disponibles al momento · Resérvalo y recógelo</p>
        <p className="font-mono text-xs break-all text-neutral-500">{url}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 print:hidden">
        <BotonImprimir />
        <a href={png} download={`qr-${tienda.slug}.png`} className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
          Descargar PNG
        </a>
        <a href={svgDescarga} download={`qr-${tienda.slug}.svg`} className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50">
          Descargar SVG (imprenta)
        </a>
      </div>
      <p className="text-center text-xs text-neutral-500 print:hidden">
        Consejo: en «Imprimir» elige «Guardar como PDF» para tener el cartel en PDF.
      </p>
    </div>
  );
}
