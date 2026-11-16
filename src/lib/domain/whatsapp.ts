/**
 * Enlaces de WhatsApp "click to chat" (wa.me) con el mensaje ya escrito.
 * No requieren la API de WhatsApp Business: abren la app del usuario.
 */

/** "+34600112233" → "https://wa.me/34600112233?text=…" */
export function enlaceWhatsApp(telefono: string, texto?: string): string | null {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 9 || digitos.length > 15) return null;
  // Número español de 9 cifras sin prefijo → 34
  const completo = digitos.length === 9 && /^[6789]/.test(digitos) ? `34${digitos}` : digitos;
  return `https://wa.me/${completo}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

export type DatosReserva = {
  nombreCliente: string;
  codigo: string;
  producto: string;
  talla: string;
  color?: string | null;
  cantidad: number;
  tienda: string;
};

const describir = (d: Pick<DatosReserva, "producto" | "talla" | "color" | "cantidad">) =>
  `${d.cantidad > 1 ? `${d.cantidad} × ` : ""}${d.producto}, talla ${d.talla}${d.color ? ` (${d.color})` : ""}`;

/** Lo que el cliente envía a la tienda tras reservar. */
export function mensajeClienteATienda(d: Omit<DatosReserva, "nombreCliente">): string {
  return `Hola, acabo de reservar en ${d.tienda}: ${describir(d)}. Código de reserva: ${d.codigo}.`;
}

/** Lo que la tienda envía al cliente según el estado de la reserva. */
export function mensajeTiendaACliente(d: DatosReserva, tipo: "lista" | "confirmada" | "cancelada"): string {
  const saludo = `Hola ${d.nombreCliente.split(" ")[0]}`;
  const que = describir(d);
  switch (tipo) {
    case "lista":
      return `${saludo}, tu reserva ${d.codigo} (${que}) ya está lista para recoger en ${d.tienda}. ¡Te esperamos!`;
    case "confirmada":
      return `${saludo}, hemos recibido tu reserva ${d.codigo} (${que}) en ${d.tienda}. Te la guardamos.`;
    case "cancelada":
      return `${saludo}, lo sentimos: tu reserva ${d.codigo} (${que}) en ${d.tienda} ha tenido que cancelarse. Si quieres, te ayudamos a buscar una alternativa.`;
  }
}
