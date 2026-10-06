import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { DEMO_BHI_TENANT_ID } from "@/repositorio/demo/constantes";
import { getRepositorio } from "@/repositorio";
import { resolverAcceso, type Acceso, type ContextoAutorizado, type Identidad } from "@/servicios/acceso";
import type { ContextoBhi, ContextoCliente } from "@/servicios/autorizacion";
import { getEnv } from "./env";
import { leerSesion, type Sesion } from "./sesion";

export function bhiTenantId(): string {
  const env = getEnv();
  return env.demo ? DEMO_BHI_TENANT_ID : env.BHI_TENANT_ID;
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
  const repo = await getRepositorio();
  const acceso = await resolverAcceso(sesion.identidad, repo, {
    bhiTenantId: bhiTenantId(),
    clienteElegidoId: sesion.clienteElegidoId,
  });
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
