import { NextResponse } from "next/server";
import { CAMPO_CSRF, origenValido, rutaInternaSegura, tokenCsrfValido } from "@/infra/csrf";
import { iniciarSesion } from "@/infra/auth/iniciar";
import { sesionDemo } from "@/infra/demo-sesion";
import { getEnv, isDemoMode } from "@/infra/env";
import { conManejoDeErrores, errorJson } from "@/infra/http";

/** Cambia la persona de la sesión. Solo existe en modo demo. */
export const POST = conManejoDeErrores(async (request, requestId) => {
  if (!isDemoMode()) return errorJson(requestId, 404, "No encontrado.");
  if (!origenValido(request, getEnv().APP_URL)) return errorJson(requestId, 403, "Origen no permitido.", "sin_permiso");

  const form = await request.formData();
  if (!tokenCsrfValido(request, String(form.get(CAMPO_CSRF) ?? ""))) {
    return errorJson(requestId, 403, "La página venció. Recargala y probá de nuevo.", "csrf");
  }
  const sesion = await sesionDemo(String(form.get("persona") ?? ""));
  if (!sesion) return errorJson(requestId, 422, "Persona demo desconocida.");

  await iniciarSesion(sesion);
  const volver = rutaInternaSegura(String(form.get("volver") ?? "/"));
  return NextResponse.redirect(new URL(volver, request.url), 303);
});
