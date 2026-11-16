# LorpenaPa

SaaS para pequeños comercios: catálogo siempre al día, tallas disponibles y «resérvalo y recógelo en tienda».

## Puesta en marcha en local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Después, rellena en `.env.local` la URL y la clave *publishable/anon* de Supabase. La app queda en http://localhost:3000.

## Base de datos (Supabase)

Las migraciones están en `supabase/migrations/` y se aplican **en orden** desde el SQL Editor:

1. `20261116000000_esquema_inicial.sql`: tablas, RLS, permisos y funciones de stock y reservas.
2. `20261116000100_programar_purga.sql`: borrado nocturno de reservas antiguas con `pg_cron` (protección de datos).
3. `20261116120000_proteger_reservas.sql`: impide borrar tallas o productos con reservas activas, y añade `ajustar_stock()` (botones +1/−1).

En **Authentication → URL Configuration**, añade `http://localhost:3000/auth/confirmar` a *Redirect URLs*.

## Cómo funciona el stock

- **Disponible = stock − reservas activas no caducadas.** Reservar no toca el stock: solo aparta la unidad.
- `crear_reserva()` (pública) bloquea la variante mientras comprueba el disponible, así que dos clientes no pueden llevarse la misma última unidad.
- `marcar_recogida()` (tienda) descuenta el stock y cierra la reserva en una sola operación.
- Una reserva caducada libera la unidad sola, sin tareas programadas.
- El público nunca ve el stock exacto ni las reservas: solo cuántas unidades hay disponibles, con `disponibilidad()`.

## Comprobaciones

```bash
npm run typecheck   # tipos de rutas + tsc --noEmit
npm test            # tests del esquema contra un Postgres real (PGlite)
```

## Rutas

- **Público:** `/t/[tienda]` (catálogo con filtros), `/t/[tienda]/p/[producto]` (ficha y «Resérvalo y recógelo»), `/t/[tienda]/privacidad`.
- **Panel:** `/panel/reservas`, `/panel/productos`, `/panel/catalogo`, `/panel/tienda`, `/panel/qr`.

El catálogo público se cachea y se renueva al editar en el panel, tras cada reserva y, además, cada pocos minutos (para reflejar las reservas que caducan solas). El navegador nunca recibe el stock exacto: solo «disponible», «últimas unidades» o «agotada».
