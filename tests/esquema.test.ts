/**
 * Tests del esquema de LorpenaPa contra un Postgres real (PGlite).
 * Cubren seguridad (RLS y permisos), stock, reservas y protección de datos.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { ANONIMO, como, crearBaseDeDatos, crearUsuarios, usuario } from "./helpers/db";

const ANA = "00000000-0000-4000-8000-00000000000a"; // dueña de "Deportes Ana" (publicada)
const BEÑAT = "00000000-0000-4000-8000-00000000000b"; // dueño de "Kirolak Beñat" (borrador)
const IKER = "00000000-0000-4000-8000-00000000000c"; // empleado de Ana

let db: PGlite;
let tiendaA: string;
let tiendaB: string;
let zapatilla: string; // producto activo de Ana
let talla42: string; // stock 1
let talla43: string; // stock 3
let varianteInactiva: string; // de un producto desactivado
let varianteB: string; // de la tienda de Beñat

type Fila = Record<string, unknown>;
const filas = async <T = Fila>(p: Promise<{ rows: unknown[] }>) => (await p).rows as T[];

/** Reserva como cliente anónimo (lo que hará la web). */
const reservar = (variante: string, telefono = "+34600000001", cantidad = 1, consentimiento = true, nombre = "Cliente") =>
  como(db, ANONIMO, (tx) =>
    filas<{ codigo: string; caduca: string }>(
      tx.query(`select * from crear_reserva($1, $2, $3, $4, $5)`, [variante, nombre, telefono, cantidad, consentimiento]),
    ),
  );

const disponible = async (tienda: string, variante: string) => {
  const r = await como(db, ANONIMO, (tx) =>
    filas<{ variant_id: string; disponible: number }>(tx.query(`select * from disponibilidad($1)`, [tienda])),
  );
  return r.find((x) => x.variant_id === variante)?.disponible;
};

beforeAll(async () => {
  db = await crearBaseDeDatos();
  await crearUsuarios(db, ANA, BEÑAT, IKER);

  tiendaA = await como(db, usuario(ANA), async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into shops (slug, name, whatsapp, is_published) values ('deportes-ana', 'Deportes Ana', '+34600111222', true) returning id`,
    );
    return r.rows[0].id;
  });
  tiendaB = await como(db, usuario(BEÑAT), async (tx) => {
    const r = await tx.query<{ id: string }>(`insert into shops (slug, name) values ('kirolak-benat', 'Kirolak Beñat') returning id`);
    return r.rows[0].id;
  });
  await como(db, usuario(ANA), (tx) =>
    tx.query(`insert into members (shop_id, user_id, role) values ($1, $2, 'staff')`, [tiendaA, IKER]),
  );

  [zapatilla, talla42, talla43, varianteInactiva] = await como(db, usuario(ANA), async (tx) => {
    const cat = await tx.query<{ id: string }>(`insert into categories (shop_id, name) values ($1, 'Hombre') returning id`, [tiendaA]);
    const marca = await tx.query<{ id: string }>(`insert into brands (shop_id, name) values ($1, 'Joluvi') returning id`, [tiendaA]);
    const p = await tx.query<{ id: string }>(
      `insert into products (shop_id, category_id, brand_id, name, price_cents, sale_price_cents, is_new)
       values ($1, $2, $3, 'Zapatilla trail', 6500, 6175, true) returning id`,
      [tiendaA, cat.rows[0].id, marca.rows[0].id],
    );
    const v42 = await tx.query<{ id: string }>(
      `insert into variants (shop_id, product_id, size, stock) values ($1, $2, '42', 1) returning id`,
      [tiendaA, p.rows[0].id],
    );
    const v43 = await tx.query<{ id: string }>(
      `insert into variants (shop_id, product_id, size, stock) values ($1, $2, '43', 3) returning id`,
      [tiendaA, p.rows[0].id],
    );
    const inactivo = await tx.query<{ id: string }>(
      `insert into products (shop_id, name, price_cents, is_active) values ($1, 'Descatalogado', 1000, false) returning id`,
      [tiendaA],
    );
    const vi = await tx.query<{ id: string }>(
      `insert into variants (shop_id, product_id, size, stock) values ($1, $2, 'M', 5) returning id`,
      [tiendaA, inactivo.rows[0].id],
    );
    return [p.rows[0].id, v42.rows[0].id, v43.rows[0].id, vi.rows[0].id];
  });

  varianteB = await como(db, usuario(BEÑAT), async (tx) => {
    const p = await tx.query<{ id: string }>(`insert into products (shop_id, name, price_cents) values ($1, 'Txapela', 2500) returning id`, [tiendaB]);
    const v = await tx.query<{ id: string }>(
      `insert into variants (shop_id, product_id, size, stock) values ($1, $2, 'Única', 4) returning id`,
      [tiendaB, p.rows[0].id],
    );
    return v.rows[0].id;
  });
});

// ---------------------------------------------------------------------
describe("integridad de los datos", () => {
  it("el precio de oferta tiene que ser menor que el normal", async () => {
    await expect(
      como(db, usuario(ANA), (tx) => tx.query(`update products set sale_price_cents = 7000 where id = $1`, [zapatilla])),
    ).rejects.toThrow(/oferta_menor_que_precio/);
  });

  it("el stock nunca puede ser negativo", async () => {
    await expect(
      como(db, usuario(ANA), (tx) => tx.query(`update variants set stock = -1 where id = $1`, [talla42])),
    ).rejects.toThrow(/check/);
  });

  it("no se repite talla en el mismo producto (sin distinguir mayúsculas)", async () => {
    await expect(
      como(db, usuario(ANA), (tx) =>
        tx.query(`insert into variants (shop_id, product_id, size) values ($1, $2, '42')`, [tiendaA, zapatilla]),
      ),
    ).rejects.toThrow(/variants_unica/);
  });

  it("no se repiten categorías ni marcas en la misma tienda", async () => {
    await expect(
      como(db, usuario(ANA), (tx) => tx.query(`insert into categories (shop_id, name) values ($1, 'HOMBRE')`, [tiendaA])),
    ).rejects.toThrow(/categories_nombre_unico/);
    // …pero otra tienda sí puede tener una categoría "Hombre"
    await como(db, usuario(BEÑAT), (tx) => tx.query(`insert into categories (shop_id, name) values ($1, 'Hombre')`, [tiendaB]));
  });

  it("el creador de una tienda queda como propietario", async () => {
    const m = await filas(db.query(`select role from members where shop_id = $1 and user_id = $2`, [tiendaA, ANA]));
    expect(m).toEqual([{ role: "owner" }]);
  });
});

// ---------------------------------------------------------------------
describe("aislamiento entre tiendas", () => {
  it("Beñat no puede modificar productos ni stock de Ana", async () => {
    await como(db, usuario(BEÑAT), async (tx) => {
      expect((await tx.query(`update products set price_cents = 1 where id = $1`, [zapatilla])).affectedRows).toBe(0);
      expect((await tx.query(`update variants set stock = 99 where id = $1`, [talla43])).affectedRows).toBe(0);
    });
  });

  it("Beñat no ve las variantes ni las reservas de Ana", async () => {
    await reservar(talla43, "+34611000001");
    await como(db, usuario(BEÑAT), async (tx) => {
      expect((await tx.query(`select * from variants where shop_id = $1`, [tiendaA])).rows).toHaveLength(0);
      expect((await tx.query(`select * from reservations where shop_id = $1`, [tiendaA])).rows).toHaveLength(0);
    });
  });

  it("Beñat no puede colgar una variante en un producto de Ana", async () => {
    await expect(
      como(db, usuario(BEÑAT), (tx) =>
        tx.query(`insert into variants (shop_id, product_id, size) values ($1, $2, '44')`, [tiendaB, zapatilla]),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("un empleado gestiona el catálogo pero no puede publicar ni cambiar la tienda", async () => {
    await como(db, usuario(IKER), async (tx) => {
      expect((await tx.query(`update products set is_new = false where id = $1`, [zapatilla])).affectedRows).toBe(1);
      expect((await tx.query(`update shops set is_published = false where id = $1`, [tiendaA])).affectedRows).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------
describe("lo que ve el público", () => {
  it("ve tiendas publicadas, no los borradores", async () => {
    const t = await como(db, ANONIMO, (tx) => filas<{ slug: string }>(tx.query(`select slug from shops`)));
    expect(t.map((x) => x.slug)).toEqual(["deportes-ana"]);
  });

  it("no ve productos desactivados ni sus variantes", async () => {
    const p = await como(db, ANONIMO, (tx) => filas<{ name: string }>(tx.query(`select name from products`)));
    expect(p.map((x) => x.name)).toEqual(["Zapatilla trail"]);
    const v = await como(db, ANONIMO, (tx) => filas(tx.query(`select id from variants where id = $1`, [varianteInactiva])));
    expect(v).toHaveLength(0);
  });

  it("ve tallas y colores, pero NO el stock exacto", async () => {
    const v = await como(db, ANONIMO, (tx) =>
      filas<{ size: string }>(tx.query(`select id, size, color from variants where product_id = $1 order by size`, [zapatilla])),
    );
    expect(v.map((x) => x.size)).toEqual(["42", "43"]);
    await expect(como(db, ANONIMO, (tx) => tx.query(`select stock from variants`))).rejects.toThrow(/permission denied/);
  });

  it("no puede leer reservas ni el equipo de nadie", async () => {
    await expect(como(db, ANONIMO, (tx) => tx.query(`select * from reservations`))).rejects.toThrow(/permission denied/);
    await expect(como(db, ANONIMO, (tx) => tx.query(`select * from members`))).rejects.toThrow(/permission denied/);
  });

  it("no puede escribir en ninguna tabla", async () => {
    await expect(
      como(db, ANONIMO, (tx) => tx.query(`update variants set size = 'X' where id = $1`, [talla42])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      como(db, ANONIMO, (tx) =>
        tx.query(
          `insert into reservations (shop_id, variant_id, code, customer_name, customer_phone, expires_at, consent_at)
           values ($1, $2, 'ABCDEF', 'X', '600000000', now() + interval '1 day', now())`,
          [tiendaA, talla42],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("disponibilidad() no devuelve nada de una tienda en borrador", async () => {
    const r = await como(db, ANONIMO, (tx) => filas(tx.query(`select * from disponibilidad($1)`, [tiendaB])));
    expect(r).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------
describe("reservas", () => {
  it("una reserva aparta la unidad y devuelve un código legible", async () => {
    expect(await disponible(tiendaA, talla42)).toBe(1);
    const [r] = await reservar(talla42, "+34 622 33 44 55", 1, true, "Miren");
    expect(r.codigo).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(await disponible(tiendaA, talla42)).toBe(0);

    // El teléfono se guarda normalizado y el stock real no cambia hasta la recogida
    const fila = await filas<{ customer_phone: string; status: string }>(
      db.query(`select customer_phone, status from reservations where code = $1`, [r.codigo]),
    );
    expect(fila).toEqual([{ customer_phone: "+34622334455", status: "pending" }]);
    const stock = await filas<{ stock: number }>(db.query(`select stock from variants where id = $1`, [talla42]));
    expect(stock[0].stock).toBe(1);
  });

  it("la última unidad no se puede reservar dos veces", async () => {
    await expect(reservar(talla42, "+34633000000")).rejects.toThrow(/No quedan unidades/);
  });

  it("no se puede reservar más de lo disponible", async () => {
    await expect(reservar(talla43, "+34644000000", 5)).rejects.toThrow(/No quedan unidades/);
  });

  it("exige consentimiento, nombre, teléfono válido y cantidad entre 1 y 5", async () => {
    await expect(reservar(talla43, "+34655000000", 1, false)).rejects.toThrow(/tratamiento de tus datos/);
    await expect(reservar(talla43, "+34655000000", 1, true, " ")).rejects.toThrow(/nombre/);
    await expect(reservar(talla43, "123")).rejects.toThrow(/teléfono/);
    await expect(reservar(talla43, "+34655000000", 0)).rejects.toThrow(/entre 1 y 5/);
  });

  it("no se puede reservar en una tienda en borrador ni un producto desactivado", async () => {
    await expect(reservar(varianteB)).rejects.toThrow(/ya no está disponible/);
    await expect(reservar(varianteInactiva)).rejects.toThrow(/ya no está disponible/);
  });

  it("máximo 3 reservas activas por teléfono y tienda (antiabuso)", async () => {
    // talla43 tiene stock 3 y ya hay 1 reservada → quedan 2; añadimos stock para el test
    await db.query(`update variants set stock = 10 where id = $1`, [talla43]);
    const tel = "+34677000000";
    await reservar(talla43, tel);
    await reservar(talla43, tel);
    await reservar(talla43, tel);
    await expect(reservar(talla43, tel)).rejects.toThrow(/3 reservas activas/);
  });

  it("una reserva caducada libera la unidad sola, sin tareas programadas", async () => {
    // Caducamos la reserva de la talla 42 (como superusuario, simulando el paso del tiempo)
    await db.query(
      `update reservations set expires_at = now() - interval '1 minute', created_at = now() - interval '3 days'
       where variant_id = $1`,
      [talla42],
    );
    expect(await disponible(tiendaA, talla42)).toBe(1);
    await reservar(talla42, "+34688000000"); // ya se puede volver a reservar
  });
});

// ---------------------------------------------------------------------
describe("gestión de reservas en tienda", () => {
  const reservaDe = async (variante: string, telefono: string) =>
    (await filas<{ id: string }>(db.query(`select id from reservations where variant_id = $1 and customer_phone = $2 and status = 'pending'`, [variante, telefono])))[0].id;

  it("marcar_recogida descuenta el stock y cierra la reserva", async () => {
    const id = await reservaDe(talla42, "+34688000000");
    await como(db, usuario(IKER), (tx) => tx.query(`select marcar_recogida($1)`, [id]));
    const r = await filas<{ status: string; cerrada: boolean }>(
      db.query(`select status, closed_at is not null as cerrada from reservations where id = $1`, [id]),
    );
    expect(r).toEqual([{ status: "collected", cerrada: true }]);
    const s = await filas<{ stock: number }>(db.query(`select stock from variants where id = $1`, [talla42]));
    expect(s[0].stock).toBe(0);
    expect(await disponible(tiendaA, talla42)).toBe(0);
  });

  it("no se puede entregar dos veces la misma reserva", async () => {
    const [{ id }] = await filas<{ id: string }>(db.query(`select id from reservations where status = 'collected' limit 1`));
    await expect(como(db, usuario(ANA), (tx) => tx.query(`select marcar_recogida($1)`, [id]))).rejects.toThrow(/cerrada/);
  });

  it("no se puede marcar como recogida «a mano» (saltándose el descuento de stock)", async () => {
    const id = await reservaDe(talla43, "+34677000000");
    await expect(
      como(db, usuario(ANA), (tx) => tx.query(`update reservations set status = 'collected' where id = $1`, [id])),
    ).rejects.toThrow(/marcar_recogida/);
  });

  it("confirmar y cancelar sí se hacen con un update normal; cancelar libera la unidad", async () => {
    const id = await reservaDe(talla43, "+34677000000");
    const antes = await disponible(tiendaA, talla43);
    await como(db, usuario(IKER), (tx) => tx.query(`update reservations set status = 'confirmed' where id = $1`, [id]));
    await como(db, usuario(IKER), (tx) => tx.query(`update reservations set status = 'cancelled' where id = $1`, [id]));
    expect(await disponible(tiendaA, talla43)).toBe((antes ?? 0) + 1);
    // …y una reserva cancelada ya no se puede reabrir
    await expect(
      como(db, usuario(ANA), (tx) => tx.query(`update reservations set status = 'pending' where id = $1`, [id])),
    ).rejects.toThrow(/cerrada/);
  });

  it("no se pueden alterar los datos de una reserva (cantidad, talla, teléfono)", async () => {
    const id = await reservaDe(talla43, "+34677000000");
    await expect(
      como(db, usuario(ANA), (tx) => tx.query(`update reservations set quantity = 5 where id = $1`, [id])),
    ).rejects.toThrow(/No se pueden cambiar/);
  });

  it("Beñat no puede entregar reservas de Ana", async () => {
    const id = await reservaDe(talla43, "+34677000000");
    await expect(como(db, usuario(BEÑAT), (tx) => tx.query(`select marcar_recogida($1)`, [id]))).rejects.toThrow(
      /no encontrada/,
    );
  });

  it("el anónimo no puede ejecutar marcar_recogida ni purgar_reservas", async () => {
    const id = await reservaDe(talla43, "+34677000000");
    await expect(como(db, ANONIMO, (tx) => tx.query(`select marcar_recogida($1)`, [id]))).rejects.toThrow(/permission denied/);
    await expect(como(db, ANONIMO, (tx) => tx.query(`select purgar_reservas()`))).rejects.toThrow(/permission denied/);
    await expect(como(db, usuario(ANA), (tx) => tx.query(`select purgar_reservas()`))).rejects.toThrow(/permission denied/);
  });
});

// ---------------------------------------------------------------------
describe("protección de datos: purga de reservas antiguas", () => {
  it("borra las cerradas o caducadas hace más de 30 días y conserva las recientes", async () => {
    const total = async () => (await filas<{ n: number }>(db.query(`select count(*)::int as n from reservations`)))[0].n;
    const antes = await total();

    // Envejecemos la reserva recogida 31 días
    await db.query(
      `update reservations set closed_at = now() - interval '31 days', created_at = now() - interval '32 days',
              expires_at = now() - interval '30 days' where status = 'collected'`,
    );
    const borradas = (await filas<{ n: number }>(db.query(`select purgar_reservas(30) as n`)))[0].n;
    expect(borradas).toBe(1);
    expect(await total()).toBe(antes - 1);
  });
});
