import { NextResponse } from "next/server";
import { rutaInternaSegura } from "@/infra/csrf";
import { iniciarSesion, sesionDemo } from "@/infra/demo-sesion";
import { isDemoMode } from "@/infra/env";
import { conManejoDeErrores, errorJson } from "@/infra/http";

export const GET = conManejoDeErrores(async (request, requestId) => {
  const volver = rutaInternaSegura(new URL(request.url).searchParams.get("volver"));

  if (isDemoMode()) {
    const sesion = await sesionDemo("usuario");
    if (!sesion) return errorJson(requestId, 500, "Falta la persona demo por defecto.");
    await iniciarSesion(sesion);
    return NextResponse.redirect(new URL(volver, request.url), 303);
  }

  // Login real con MSAL Node + PKCE: etapa 2.
  return errorJson(requestId, 503, "El inicio de sesión con Microsoft todavía no está configurado.", "login_no_configurado");
});
