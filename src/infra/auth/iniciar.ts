import "server-only";
import { getRepositorio } from "@/repositorio";
import { registrarSolicitudSiCorresponde, resolverAcceso } from "@/servicios/acceso";
import { invalidarAcceso } from "../cache-acceso";
import { guardarSesion, type NuevaSesion } from "../sesion";
import { bhiTenantIds } from "./config";

/**
 * Cierre común del login (Microsoft o persona demo): guarda la cookie de sesión y, si la
 * organización no está habilitada, deja registrada la solicitud de acceso.
 */
export async function iniciarSesion(sesion: NuevaSesion): Promise<void> {
  await guardarSesion(sesion);
  invalidarAcceso(sesion.identidad);
  const repo = await getRepositorio();
  const acceso = await resolverAcceso(sesion.identidad, repo, { bhiTenantIds: bhiTenantIds() });
  await registrarSolicitudSiCorresponde(sesion.identidad, acceso, repo);
}
