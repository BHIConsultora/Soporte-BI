import "server-only";
import { getRepositorio } from "@/repositorio";
import { registrarSolicitudSiCorresponde, resolverAcceso } from "@/servicios/acceso";
import { bhiTenantId } from "./contexto";
import { guardarSesion, type Sesion } from "./sesion";

/** Arma la sesión de una persona demo. Importa los datos dinámicamente (solo modo demo). */
export async function sesionDemo(clave: string): Promise<Sesion | null> {
  const { PERSONAS_DEMO } = await import("@/repositorio/demo/datos");
  const p = PERSONAS_DEMO.find((x) => x.clave === clave);
  if (!p) return null;
  const { clave: _c, descripcion: _d, ...identidad } = p;
  return { identidad, clienteElegidoId: null };
}

/**
 * Inicio de sesión (demo hoy, MSAL en la etapa 2): guarda la cookie y, si el tenant
 * no está habilitado, deja registrada la solicitud de acceso.
 */
export async function iniciarSesion(sesion: Sesion): Promise<void> {
  await guardarSesion(sesion);
  const repo = await getRepositorio();
  const acceso = await resolverAcceso(sesion.identidad, repo, { bhiTenantId: bhiTenantId() });
  await registrarSolicitudSiCorresponde(sesion.identidad, acceso, repo);
}
