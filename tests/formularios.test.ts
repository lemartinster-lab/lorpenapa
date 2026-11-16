import { describe, expect, it } from "vitest";
import { expandirTallas } from "@/lib/domain/tallas";
import {
  buscarDuplicado,
  leerDatosTienda,
  leerNombre,
  leerNuevaTienda,
  leerProducto,
  leerVariante,
  normalizarTelefono,
} from "@/lib/acciones/formularios";

const fd = (campos: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const CAT = "11111111-1111-4111-8111-111111111111";
const MARCA = "22222222-2222-4222-8222-222222222222";

describe("expandirTallas", () => {
  const ok = (t: string) => {
    const r = expandirTallas(t);
    if (!r.ok) throw new Error(r.error);
    return r.tallas;
  };

  it("rango de calzado", () => {
    expect(ok("38-46")).toEqual(["38", "39", "40", "41", "42", "43", "44", "45", "46"]);
    expect(ok("38 - 40")).toEqual(["38", "39", "40"]);
  });

  it("medios puntos, con punto o con coma decimal", () => {
    expect(ok("36.5-38")).toEqual(["36,5", "37", "37,5", "38"]);
    expect(ok("36,5-38")).toEqual(["36,5", "37", "37,5", "38"]);
  });

  it("tallas de ropa separadas por comas o espacios, en mayúsculas", () => {
    expect(ok("s, m, l, xl")).toEqual(["S", "M", "L", "XL"]);
    expect(ok("S M L")).toEqual(["S", "M", "L"]);
  });

  it("mezcla de rangos y tallas sueltas, sin duplicados", () => {
    expect(ok("38-40, 42, 39")).toEqual(["38", "39", "40", "42"]);
  });

  it("talla única", () => {
    expect(ok("única")).toEqual(["Única"]);
  });

  it("explica los errores", () => {
    expect(expandirTallas("")).toMatchObject({ ok: false });
    expect(expandirTallas("46-38")).toMatchObject({ ok: false, error: expect.stringMatching(/al revés/) });
    expect(expandirTallas("1-100")).toMatchObject({ ok: false, error: expect.stringMatching(/máximo es 40/) });
    expect(expandirTallas("talla-extraordinariamente-larga")).toMatchObject({ ok: false });
  });
});

describe("normalizarTelefono", () => {
  it.each([
    ["600 11 22 33", "+34600112233"],
    ["+34 600-11-22-33", "+34600112233"],
    ["979700199", "+34979700199"],
    ["+33612345678", "+33612345678"],
  ])("%s → %s", (entrada, salida) => {
    expect(normalizarTelefono(entrada)).toBe(salida);
  });

  it.each(["123", "abc", "+34 600 11"])("rechaza «%s»", (t) => {
    expect(normalizarTelefono(t)).toBeNull();
  });
});

describe("leerNuevaTienda", () => {
  it("genera la dirección web y normaliza el WhatsApp", () => {
    expect(leerNuevaTienda(fd({ nombre: "Kirolak Beñat", whatsapp: "600 11 22 33" }))).toEqual({
      ok: true,
      datos: { name: "Kirolak Beñat", slug: "kirolak-benat", whatsapp: "+34600112233" },
    });
  });

  it("el WhatsApp es opcional, pero si se escribe tiene que ser válido", () => {
    expect(leerNuevaTienda(fd({ nombre: "Kirolak" }))).toMatchObject({ ok: true, datos: { whatsapp: null } });
    expect(leerNuevaTienda(fd({ nombre: "Kirolak", whatsapp: "123" })).ok).toBe(false);
  });
});

describe("leerDatosTienda", () => {
  const base = { nombre: "Kirolak", whatsapp: "", direccion: "Calle Mayor 1", horario: "L-V 10-14", horas_reserva: "48" };

  it("acepta datos correctos (campos vacíos como null)", () => {
    expect(leerDatosTienda(fd(base))).toEqual({
      ok: true,
      datos: { name: "Kirolak", whatsapp: null, address: "Calle Mayor 1", opening_hours: "L-V 10-14", reservation_hours: 48 },
    });
  });

  it("las reservas duran entre 1 y 168 horas", () => {
    expect(leerDatosTienda(fd({ ...base, horas_reserva: "0" })).ok).toBe(false);
    expect(leerDatosTienda(fd({ ...base, horas_reserva: "200" })).ok).toBe(false);
    expect(leerDatosTienda(fd({ ...base, horas_reserva: "24.5" })).ok).toBe(false);
  });
});

describe("categorías y marcas", () => {
  it("normaliza espacios del nombre", () => {
    expect(leerNombre(fd({ nombre: "  Calzado   trail " }), "categoría")).toEqual({ ok: true, datos: { name: "Calzado trail" } });
  });

  it("detecta duplicados sin distinguir mayúsculas ni tildes", () => {
    const existentes = [{ id: "a", name: "Niños" }];
    expect(buscarDuplicado(existentes, "NINOS")).toBe("Niños");
    expect(buscarDuplicado(existentes, "niños", "a")).toBeNull(); // al renombrar la propia
  });
});

describe("leerProducto", () => {
  const base = { nombre: "Chaleco Joluvi Heat", precio: "65,00", oferta: "61,75", categoria: CAT, marca: MARCA, activo: "on" };

  it("lee precio y oferta en céntimos", () => {
    expect(leerProducto(fd(base))).toEqual({
      ok: true,
      datos: {
        name: "Chaleco Joluvi Heat",
        description: null,
        category_id: CAT,
        brand_id: MARCA,
        price_cents: 6500,
        sale_price_cents: 6175,
        is_new: false,
        is_active: true,
      },
    });
  });

  it("la oferta es opcional y tiene que ser menor que el precio", () => {
    expect(leerProducto(fd({ ...base, oferta: "" }))).toMatchObject({ ok: true, datos: { sale_price_cents: null } });
    expect(leerProducto(fd({ ...base, oferta: "70" }))).toEqual({
      ok: false,
      error: "El precio de oferta tiene que ser menor que el precio normal.",
    });
  });

  it("categoría y marca vacías son null; manipuladas, error", () => {
    expect(leerProducto(fd({ ...base, categoria: "", marca: "" }))).toMatchObject({
      ok: true,
      datos: { category_id: null, brand_id: null },
    });
    expect(leerProducto(fd({ ...base, marca: "x' or 1=1" })).ok).toBe(false);
  });
});

describe("leerVariante", () => {
  it("lee una fila de la tabla de tallas", () => {
    expect(leerVariante(fd({ talla: "42", color: "Negro", referencia: "", stock: "3" }))).toEqual({
      ok: true,
      datos: { size: "42", color: "Negro", sku: null, stock: 3 },
    });
  });

  it("stock vacío es 0; negativo o decimal, error", () => {
    expect(leerVariante(fd({ talla: "M", stock: "" }))).toMatchObject({ ok: true, datos: { stock: 0 } });
    expect(leerVariante(fd({ talla: "M", stock: "-1" })).ok).toBe(false);
    expect(leerVariante(fd({ talla: "M", stock: "1.5" })).ok).toBe(false);
  });
});
