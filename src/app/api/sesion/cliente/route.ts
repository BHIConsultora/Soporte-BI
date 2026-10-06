import { NextResponse } from "next/server";
import { bhiTenantId } from "@/infra/contexto";
import { origenValido } from "@/infra/csrf";
import { getEnv } from "@/infra/env";
import { conManejoDeErrores, errorJson } from "@/infra/http";
import { guardarSesion, leerSesion } from "@/infra/sesion";
import { getRepositorio } from "@/repositorio";
import { resolverAcceso } from "@/servicios/acceso";

/** Guarda el cliente elegido por un usuario satélite que pertenece a varios grupos. */
export const POST = conManejoDeErrores(async (request, requestId) => {
  if (!origenValido(request, getEnv().APP_URL)) return errorJson(requestId, 403, "Origen no permitido.", "sin_permiso");
  const sesion = await leerSesion();
  if (!sesion) return errorJson(requestId, 401, "Tenés que iniciar sesión.");

  const clienteId = Number((await request.formData()).get("clienteId"));
  if (!Number.isSafeInteger(clienteId)) return errorJson(requestId, 422, "Cliente inválido.");

  // Se valida contra los grupos actuales: la elección no puede abrir un cliente ajeno.
  const acceso = await resolverAcceso(sesion.identidad, await getRepositorio(), {
    bhiTenantId: bhiTenantId(),
    clienteElegidoId: clienteId,
  });
  if (acceso.tipo !== "cliente" || acceso.cliente.id !== clienteId) {
    return errorJson(requestId, 403, "No tenés acceso a ese cliente.", "sin_permiso");
  }

  await guardarSesion({ ...sesion, clienteElegidoId: clienteId });
  return NextResponse.redirect(new URL("/", request.url), 303);
});
