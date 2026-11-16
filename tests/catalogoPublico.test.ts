import { describe, expect, it } from "vitest";
import {
  compararTallas,
  estadoTalla,
  etiquetaTienda,
  filtrarProductos,
  montarCatalogoPublico,
} from "@/lib/domain/catalogoPublico";
import { enlaceWhatsApp, mensajeClienteATienda, mensajeTiendaACliente } from "@/lib/domain/whatsapp";
import { leerReserva, mensajeErrorReserva } from "@/lib/acciones/formularios";

const V = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const tienda = {
  id: "t1",
  name: "Kirolak",
  slug: "kirolak",
  whatsapp: "+34600112233",
  address: "Calle Mayor 1",
  opening_hours: null,
  reservation_hours: 48,
};

const catalogo = montarCatalogoPublico(
  tienda,
  [
    { id: "c-mujer", name: "Mujer", position: 1 },
    { id: "c-hombre", name: "Hombre", position: 0 },
    { id: "c-vacia", name: "Niños", position: 2 },
  ],
  [
    { id: "m-joluvi", name: "Joluvi" },
    { id: "m-sin-uso", name: "Adidas" },
  ],
  [
    { id: "p-chaleco", name: "Chaleco", description: null, category_id: "c-hombre", brand_id: "m-joluvi", price_cents: 6500, sale_price_cents: 6175, is_new: true, position: 0 },
    { id: "p-malla", name: "Malla", description: null, category_id: "c-mujer", brand_id: null, price_cents: 3000, sale_price_cents: null, is_new: false, position: 1 },
    { id: "p-sin-tallas", name: "Sin tallas", description: null, category_id: "c-vacia", brand_id: "m-sin-uso", price_cents: 1000, sale_price_cents: null, is_new: false, position: 2 },
  ],
  [
    { id: V(1), product_id: "p-chaleco", size: "L", color: null, position: 1 },
    { id: V(2), product_id: "p-chaleco", size: "M", color: null, position: 0 },
    { id: V(3), product_id: "p-malla", size: "S", color: "Negro", position: 0 },
    { id: V(4), product_id: "p-malla", size: "M", color: "Negro", position: 1 },
  ],
  [
    { variant_id: V(1), disponible: 5 },
    { variant_id: V(2), disponible: 1 },
    { variant_id: V(3), disponible: 0 },
    // V(4) sin dato → agotada
  ],
);

describe("montarCatalogoPublico", () => {
  it("convierte unidades en estados, sin dejar salir el número", () => {
    const chaleco = catalogo.productos[0];
    expect(chaleco.tallas).toEqual([
      { id: V(2), talla: "M", color: null, estado: "ultimas" },
      { id: V(1), talla: "L", color: null, estado: "disponible" },
    ]);
    expect(JSON.stringify(catalogo)).not.toMatch(/disponible":\s*\d|stock/);
  });

  it("una talla sin dato de disponibilidad cuenta como agotada", () => {
    expect(catalogo.productos[1].tallas.map((t) => t.estado)).toEqual(["agotada", "agotada"]);
  });

  it("oculta productos sin tallas, y categorías y marcas sin productos visibles", () => {
    expect(catalogo.productos.map((p) => p.id)).toEqual(["p-chaleco", "p-malla"]);
    expect(catalogo.categorias.map((c) => c.nombre)).toEqual(["Hombre", "Mujer"]);
    expect(catalogo.marcas.map((m) => m.nombre)).toEqual(["Joluvi"]);
  });

  it("calcula el descuento y la marca de cada producto", () => {
    expect(catalogo.productos[0]).toMatchObject({ descuento: 5, marca: "Joluvi", nuevo: true });
    expect(catalogo.productos[1]).toMatchObject({ descuento: null, marca: null });
  });

  it("lista las tallas de la tienda sin duplicados y en orden lógico", () => {
    expect(catalogo.tallas).toEqual(["S", "M", "L"]);
  });
});

describe("compararTallas y estadoTalla", () => {
  it("ordena números, luego ropa, luego el resto", () => {
    expect(["L", "42", "Única", "S", "38", "36,5", "XL"].sort(compararTallas)).toEqual([
      "36,5", "38", "42", "S", "L", "XL", "Única",
    ]);
  });

  it("umbral de «últimas unidades»", () => {
    expect([0, 1, 2, 3].map(estadoTalla)).toEqual(["agotada", "ultimas", "ultimas", "disponible"]);
  });
});

describe("filtrarProductos", () => {
  const ids = (f: Parameters<typeof filtrarProductos>[1]) => filtrarProductos(catalogo.productos, f).map((p) => p.id);

  it("sin filtros, todo", () => {
    expect(ids({})).toEqual(["p-chaleco", "p-malla"]);
  });

  it("por categoría, marca y ofertas", () => {
    expect(ids({ categoria: "c-mujer" })).toEqual(["p-malla"]);
    expect(ids({ marca: "m-joluvi" })).toEqual(["p-chaleco"]);
    expect(ids({ soloOfertas: true })).toEqual(["p-chaleco"]);
  });

  it("«mi talla» solo muestra productos con esa talla disponible ahora", () => {
    expect(ids({ talla: "m" })).toEqual(["p-chaleco"]); // la M de la malla está agotada
    expect(ids({ talla: "S" })).toEqual([]);
  });
});

describe("WhatsApp", () => {
  it("construye el enlace wa.me con el mensaje codificado", () => {
    expect(enlaceWhatsApp("+34 600 11 22 33", "Hola ¿qué tal?")).toBe(
      "https://wa.me/34600112233?text=Hola%20%C2%BFqu%C3%A9%20tal%3F",
    );
    expect(enlaceWhatsApp("600112233")).toBe("https://wa.me/34600112233");
    expect(enlaceWhatsApp("123")).toBeNull();
  });

  const datos = { nombreCliente: "Miren Etxeberria", codigo: "ABC234", producto: "Chaleco", talla: "M", color: "Marrón", cantidad: 1, tienda: "Kirolak" };

  it("mensajes de la tienda al cliente, con su nombre de pila", () => {
    expect(mensajeTiendaACliente(datos, "lista")).toBe(
      "Hola Miren, tu reserva ABC234 (Chaleco, talla M (Marrón)) ya está lista para recoger en Kirolak. ¡Te esperamos!",
    );
    expect(mensajeTiendaACliente({ ...datos, cantidad: 2 }, "cancelada")).toMatch(/2 × Chaleco/);
  });

  it("mensaje del cliente a la tienda con el código", () => {
    expect(mensajeClienteATienda(datos)).toMatch(/Código de reserva: ABC234/);
  });
});

describe("leerReserva", () => {
  const fd = (c: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(c)) f.append(k, v);
    return f;
  };
  const base = { talla: V(1), nombre: " Miren  Etxeberria ", telefono: "600 11 22 33", cantidad: "1", consentimiento: "on" };

  it("lee y normaliza una reserva correcta", () => {
    expect(leerReserva(fd(base))).toEqual({
      ok: true,
      datos: { varianteId: V(1), nombre: "Miren Etxeberria", telefono: "+34600112233", cantidad: 1 },
    });
  });

  it("exige consentimiento", () => {
    const sin = Object.fromEntries(Object.entries(base).filter(([k]) => k !== "consentimiento"));
    expect(leerReserva(fd(sin))).toMatchObject({ ok: false, error: expect.stringMatching(/aceptar/) });
  });

  it("el campo trampa delata a los bots", () => {
    expect(leerReserva(fd({ ...base, web: "http://spam" }))).toMatchObject({ ok: false, bot: true });
  });

  it("valida talla, teléfono y cantidad", () => {
    expect(leerReserva(fd({ ...base, talla: "x" })).ok).toBe(false);
    expect(leerReserva(fd({ ...base, telefono: "12" })).ok).toBe(false);
    expect(leerReserva(fd({ ...base, cantidad: "9" })).ok).toBe(false);
  });

  it("traduce los errores de la base de datos", () => {
    expect(mensajeErrorReserva("sin_stock")).toMatch(/últimas unidades/);
    expect(mensajeErrorReserva("limite")).toMatch(/3 reservas/);
    expect(mensajeErrorReserva(undefined)).toMatch(/Inténtalo de nuevo/);
  });
});

describe("etiquetaTienda", () => {
  it("es distinta por tienda", () => {
    expect(etiquetaTienda("a")).not.toBe(etiquetaTienda("b"));
  });
});
