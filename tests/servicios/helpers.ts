import { crearDemoRepo } from "@/repositorio/demo";
import { DEMO_BHI_TENANT_ID, crearDatosDemo, persona } from "@/repositorio/demo/datos";
import type { Repositorio } from "@/repositorio/tipos";
import { resolverAcceso, type ContextoAutorizado, type Identidad } from "@/servicios/acceso";
import { notificadorNulo, type Deps, type Notificador } from "@/servicios/deps";
import { ErrorServicio } from "@/servicios/errores";

/** Martes 6/10/2026, 12:00 en Buenos Aires (horario hábil). */
export const AHORA = new Date("2026-10-06T15:00:00Z");

export function repoDemo(): Repositorio {
  return crearDemoRepo(crearDatosDemo(AHORA));
}

export function depsDemo(repo = repoDemo(), notificador: Notificador = notificadorNulo, ahora = AHORA): Deps {
  return { repo, notificador, ahora: () => ahora };
}

export function identidadDe(clave: string): Identidad {
  const { clave: _c, descripcion: _d, ...identidad } = persona(clave);
  return identidad;
}

export async function contextoDe(clave: string, repo: Repositorio = repoDemo()): Promise<ContextoAutorizado> {
  const identidad = identidadDe(clave);
  const acceso = await resolverAcceso(identidad, repo, { bhiTenantIds: [DEMO_BHI_TENANT_ID] });
  if (acceso.tipo !== "bhi" && acceso.tipo !== "cliente") throw new Error(`${clave} no tiene acceso: ${acceso.tipo}`);
  return { identidad, acceso };
}

/** Resultado de una operación como `ok` o el status del error de servicio. */
export async function resultado(fn: () => Promise<unknown>): Promise<"ok" | number> {
  try {
    await fn();
    return "ok";
  } catch (err) {
    if (err instanceof ErrorServicio) return err.status;
    throw err;
  }
}

export const ARCHIVO_PNG = { nombre: "captura.png", datos: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]) };
