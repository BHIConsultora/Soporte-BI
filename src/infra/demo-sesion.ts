import "server-only";
import type { NuevaSesion } from "./sesion";

/** Arma la sesión de una persona demo. Importa los datos dinámicamente (solo modo demo). */
export async function sesionDemo(clave: string): Promise<NuevaSesion | null> {
  const { PERSONAS_DEMO } = await import("@/repositorio/demo/datos");
  const p = PERSONAS_DEMO.find((x) => x.clave === clave);
  if (!p) return null;
  const { clave: _c, descripcion: _d, ...identidad } = p;
  return { identidad, clienteElegidoId: null };
}
