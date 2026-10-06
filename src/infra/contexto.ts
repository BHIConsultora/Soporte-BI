import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getRepositorio } from "@/repositorio";
import { resolverAcceso, type Acceso, type ContextoAutorizado, type Identidad } from "@/servicios/acceso";
import type { ContextoBhi, ContextoCliente } from "@/servicios/autorizacion";
import { bhiTenantIds } from "./auth/config";
import { accesoConCache, claveAcceso } from "./cache-acceso";
import { getEnv } from "./env";
import { leerSesion, type Sesion } from "./sesion";

/** Segundos de caché del acceso: configurable, 120 por defecto y 0 en demo (cambios al instante). */
function ttlAcceso(): number {
  const env = getEnv();
  return env.ACCESO_CACHE_SEGUNDOS ?? (env.demo ? 0 : 120);
}

export interface ContextoRequest {
  sesion: Sesion;
  identidad: Identidad;
  acceso: Acceso;
}

/**
 * Sesión + acceso recalculado en el servidor. `null` si no hay sesión válida.
 * `cache` lo deduplica dentro de un mismo request (layout + página).
 */
export const obtenerContexto = cache(async (): Promise<ContextoRequest | null> => {
  const sesion = await leerSesion();
  if (!sesion) return null;
  const acceso = await accesoConCache(claveAcceso(sesion.identidad, sesion.clienteElegidoId), ttlAcceso(), async () =>
    resolverAcceso(sesion.identidad, await getRepositorio(), {
      bhiTenantIds: bhiTenantIds(),
      clienteElegidoId: sesion.clienteElegidoId,
    }),
  );
  return { sesion, identidad: sesion.identidad, acceso };
});

/** Para pantallas: redirige a login, a "no habilitado" o al selector de cliente según corresponda. */
export async function requerirContexto(): Promise<ContextoAutorizado & { sesion: Sesion }> {
  const ctx = await obtenerContexto();
  if (!ctx) {
    const url = (await headers()).get("x-url") ?? "/";
    redirect(`/bienvenida?volver=${encodeURIComponent(url)}`);
  }
  const { acceso } = ctx;
  if (acceso.tipo === "denegado") redirect(`/no-habilitado?motivo=${acceso.code}`);
  if (acceso.tipo === "elegir_cliente") redirect("/elegir-cliente");
  return { sesion: ctx.sesion, identidad: ctx.identidad, acceso };
}

/** Pantallas de cliente. El equipo de BHI va a su propio inicio (kanban). */
export async function requerirCliente(): Promise<ContextoCliente> {
  const ctx = await requerirContexto();
  if (ctx.acceso.tipo !== "cliente") redirect("/soporte");
  return ctx as ContextoCliente;
}

/** Pantallas de soporte: para un cliente no existen (404). */
export async function requerirSoporte(): Promise<ContextoBhi> {
  const ctx = await requerirContexto();
  if (ctx.acceso.tipo !== "bhi") notFound();
  return ctx as ContextoBhi;
}

export async function requerirAdmin(): Promise<ContextoBhi> {
  const ctx = await requerirSoporte();
  if (ctx.acceso.rol !== "admin") notFound();
  return ctx;
}
