import { describe, expect, it } from "vitest";
import { formatearPrecio, parsearPrecio, porcentajeDescuento } from "@/lib/domain/precio";
import { generarSlug } from "@/lib/domain/slug";

describe("precio", () => {
  it("formatea céntimos en euros con formato español", () => {
    expect(formatearPrecio(6175).replace(/\s/g, " ")).toBe("61,75 €");
  });

  it.each([
    ["61,75 €", 6175],
    ["65.00€", 6500],
    ["1.250,00 €", 125000],
    ["20", 2000],
  ])("interpreta %s como %i céntimos", (texto, centimos) => {
    expect(parsearPrecio(texto)).toBe(centimos);
  });

  it.each(["", "gratis", "1.2.3", "-5"])("no adivina con '%s'", (texto) => {
    expect(parsearPrecio(texto)).toBeNull();
  });
});

describe("porcentajeDescuento", () => {
  it("calcula la etiqueta de oferta (65,00 € → 61,75 € = -5 %)", () => {
    expect(porcentajeDescuento(6500, 6175)).toBe(5);
    expect(porcentajeDescuento(10000, 7000)).toBe(30);
  });

  it("nunca muestra «-0 %»: un descuento mínimo cuenta como 1 %", () => {
    expect(porcentajeDescuento(10000, 9990)).toBe(1);
  });

  it("sin oferta, o con una oferta que no rebaja, no hay etiqueta", () => {
    expect(porcentajeDescuento(6500, null)).toBeNull();
    expect(porcentajeDescuento(6500, 6500)).toBeNull();
    expect(porcentajeDescuento(6500, 7000)).toBeNull();
  });
});

describe("generarSlug", () => {
  it.each([
    ["Deportes Artza", "deportes-artza"],
    ["Kirolak Beñat", "kirolak-benat"],
    ["  Zapatería  Ñ&Co. ", "zapateria-n-co"],
  ])("%s → %s", (nombre, esperado) => {
    expect(generarSlug(nombre)).toBe(esperado);
  });
});
