import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DEMO_BHI_TENANT_ID } from "@/repositorio/demo/constantes";
import { getRepositorio } from "@/repositorio";
import { resolverAcceso, type Acceso, type Identidad } from "@/servicios/acceso";
import type { ContextoAutorizado } from "@/servicios/tickets";
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
