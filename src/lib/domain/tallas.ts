/**
 * "Añadir tallas en bloque": convierte lo que escribe el tendero en una
 * lista de tallas.
 *
 *   "38-46"          → 38, 39, …, 46
 *   "36.5-39"        → 36.5, 37, 37.5, …, 39   (medios puntos)
 *   "36,5-38"        → igual: la coma decimal española también vale
 *   "S, M, L, XL"    → S, M, L, XL
 *   "38-40, 42"      → 38, 39, 40, 42
 *   "única"          → Única
 *
 * Quita duplicados (sin distinguir mayúsculas) y respeta el orden escrito.
 */

export const MAX_TALLAS_EN_BLOQUE = 40;
const MAX_LARGO_TALLA = 20;

export type ResultadoTallas = { ok: true; tallas: string[] } | { ok: false; error: string };

const formatear = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));

export function expandirTallas(texto: string): ResultadoTallas {
  // Coma decimal (36,5) → punto, para no confundirla con el separador de lista
  const normalizado = texto
    .replace(/(\d+),5(?!\d)/g, "$1.5")
    .replace(/\s*-\s*/g, "-") // "38 - 46" → "38-46"
    .trim();
  if (!normalizado) return { ok: false, error: "Escribe al menos una talla, por ejemplo «38-46» o «S, M, L»." };

  const trozos = normalizado
    .split(/[,;\n]+|\s{2,}|\s+(?=\S)/)
    .map((t) => t.trim())
    .filter(Boolean);

  const tallas: string[] = [];
  for (const trozo of trozos) {
    const rango = trozo.match(/^(\d{1,3}(?:\.5)?)\s*-\s*(\d{1,3}(?:\.5)?)$/);
    if (rango) {
      const desde = Number(rango[1]);
      const hasta = Number(rango[2]);
      if (desde > hasta) return { ok: false, error: `El rango «${trozo}» va al revés: pon primero la talla menor.` };
      const paso = rango[1].includes(".") || rango[2].includes(".") ? 0.5 : 1;
      const cuantas = Math.round((hasta - desde) / paso) + 1;
      if (cuantas > MAX_TALLAS_EN_BLOQUE) {
        return { ok: false, error: `El rango «${trozo}» crearía ${cuantas} tallas; el máximo es ${MAX_TALLAS_EN_BLOQUE}.` };
      }
      for (let i = 0; i < cuantas; i++) tallas.push(formatear(desde + i * paso));
      continue;
    }
    if (trozo.length > MAX_LARGO_TALLA) {
      return { ok: false, error: `La talla «${trozo}» es demasiado larga (máximo ${MAX_LARGO_TALLA} caracteres).` };
    }
    tallas.push(/^[a-zñ]+$/i.test(trozo) && trozo.length <= 4 ? trozo.toUpperCase() : capitalizar(trozo));
  }

  const vistas = new Set<string>();
  const unicas = tallas.filter((t) => {
    const clave = t.toLowerCase();
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });

  if (unicas.length > MAX_TALLAS_EN_BLOQUE) {
    return { ok: false, error: `Son ${unicas.length} tallas; el máximo de una vez es ${MAX_TALLAS_EN_BLOQUE}.` };
  }
  return { ok: true, tallas: unicas };
}

function capitalizar(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
