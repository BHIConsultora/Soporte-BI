import { origenValido } from "@/infra/csrf";
import { getEnv, isDemoMode } from "@/infra/env";
import { conManejoDeErrores, errorJson } from "@/infra/http";
import { reiniciarRepositorioDemo } from "@/repositorio";

/** Solo modo demo: vuelve a los datos iniciales (lo usan los tests e2e). */
export const POST = conManejoDeErrores(async (request, requestId) => {
  if (!isDemoMode()) return errorJson(requestId, 404, "No encontrado.");
  if (!origenValido(request, getEnv().APP_URL)) return errorJson(requestId, 403, "Origen no permitido.", "sin_permiso");
  reiniciarRepositorioDemo();
  return new Response(null, { status: 204 });
});
