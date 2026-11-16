-- solo-supabase
-- =====================================================================
-- LorpenaPa · Purga nocturna de reservas antiguas (protección de datos)
--
-- Usa pg_cron, que Supabase incluye. Este archivo NO se carga en los tests
-- (PGlite no tiene pg_cron): la función purgar_reservas() sí se prueba.
-- =====================================================================
create extension if not exists pg_cron with schema pg_catalog;

-- Cada día a las 04:00 UTC borra las reservas cerradas o caducadas hace +30 días
select cron.schedule(
  'lorpenapa-purgar-reservas',
  '0 4 * * *',
  $$select public.purgar_reservas(30)$$
);
