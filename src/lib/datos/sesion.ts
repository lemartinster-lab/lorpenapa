import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { FilaTienda, Rol } from "@/lib/supabase/tipos";

export type Contexto = {
  supabase: Awaited<ReturnType<typeof clienteServidor>>;
  usuarioId: string;
  email: string | null;
};

/**
 * Usuario de la sesión, verificado con getClaims (valida la firma del JWT).
 * Devuelve null si no hay sesión.
 */
export async function obtenerSesion(): Promise<Contexto | null> {
  // La sesión se verifica SIEMPRE con la petición real: getClaims compara
  // la caducidad del token con Date.now(), algo que Next.js 16 no permite
  // al preparar páginas por adelantado (prefetch / App Shell).
  await connection();
  const supabase = await clienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { supabase, usuarioId: sub, email };
}

/** Como obtenerSesion, pero manda a /entrar si no hay sesión. */
export async function exigirSesion(): Promise<Contexto> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/entrar");
  return sesion;
}

export type ContextoTienda = Contexto & {
  tienda: FilaTienda;
  rol: Rol;
};

/**
 * Tienda con la que trabaja el usuario. De momento, la primera que creó o
 * a la que se unió (más adelante habrá selector si gestiona varias).
 * Devuelve null si aún no tiene ninguna.
 */
export async function obtenerTienda(ctx: Contexto): Promise<ContextoTienda | null> {
  const { data: miembro, error } = await ctx.supabase
    .from("members")
    .select("shop_id, role")
    .eq("user_id", ctx.usuarioId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el equipo: ${error.message}`);
  if (!miembro) return null;

  const { data: tienda, error: e2 } = await ctx.supabase
    .from("shops")
    .select("*")
    .eq("id", miembro.shop_id)
    .single();
  if (e2) throw new Error(`No se pudo leer la tienda: ${e2.message}`);

  return { ...ctx, tienda, rol: miembro.role };
}

/** Exige sesión y tienda; si falta la tienda, lleva a crearla. */
export async function exigirTienda(): Promise<ContextoTienda> {
  const ctx = await exigirSesion();
  const conTienda = await obtenerTienda(ctx);
  if (!conTienda) redirect("/panel/nueva");
  return conTienda;
}
