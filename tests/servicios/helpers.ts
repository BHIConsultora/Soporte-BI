import { crearDemoRepo } from "@/repositorio/demo";
import { DEMO_BHI_TENANT_ID, crearDatosDemo, persona } from "@/repositorio/demo/datos";
import { resolverAcceso, type Identidad } from "@/servicios/acceso";
import type { ContextoAutorizado } from "@/servicios/tickets";

export const AHORA = new Date("2026-10-06T15:00:00Z");

export function repoDemo() {
  return crearDemoRepo(crearDatosDemo(AHORA));
}

export function identidadDe(clave: string): Identidad {
  const { clave: _c, descripcion: _d, ...identidad } = persona(clave);
  return identidad;
}

export async function contextoDe(clave: string, repo = repoDemo()): Promise<ContextoAutorizado> {
  const identidad = identidadDe(clave);
  const acceso = await resolverAcceso(identidad, repo, { bhiTenantId: DEMO_BHI_TENANT_ID });
  if (acceso.tipo !== "bhi" && acceso.tipo !== "cliente") throw new Error(`${clave} no tiene acceso: ${acceso.tipo}`);
  return { identidad, acceso };
}
