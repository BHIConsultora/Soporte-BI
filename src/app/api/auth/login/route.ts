import { NextResponse } from "next/server";
import { configAuth, SCOPES_LOGIN } from "@/infra/auth/config";
import { iniciarSesion } from "@/infra/auth/iniciar";
import { clientePortal } from "@/infra/auth/msal";
import { cifrarTransaccion, COOKIE_LOGIN, nuevaTransaccion, opcionesCookieLogin } from "@/infra/auth/transaccion";
import { rutaInternaSegura } from "@/infra/csrf";
import { sesionDemo } from "@/infra/demo-sesion";
import { isDemoMode } from "@/infra/env";
import { conManejoDeErrores, errorJson } from "@/infra/http";

/**
 * Inicio de sesión.
 * - `modo=microsoft` (o producción): auth code + PKCE contra Entra ID, autoridad `organizations`.
 * - Modo demo sin `modo=microsoft`: entra con la persona demo por defecto.
 */
export const GET = conManejoDeErrores(async (request, requestId) => {
  const sp = new URL(request.url).searchParams;
  const volver = rutaInternaSegura(sp.get("volver"));
  const cfg = configAuth();

  if (isDemoMode() && sp.get("modo") !== "microsoft") {
    const sesion = await sesionDemo("usuario");
    if (!sesion) return errorJson(requestId, 500, "Falta la persona demo por defecto.");
    await iniciarSesion(sesion);
    return NextResponse.redirect(new URL(volver, request.url), 303);
  }

  if (!cfg) {
    return errorJson(requestId, 503, "El inicio de sesión con Microsoft todavía no está configurado.", "login_no_configurado");
  }

  const { transaccion, codeChallenge } = await nuevaTransaccion(volver);
  const url = await clientePortal(cfg).getAuthCodeUrl({
    scopes: SCOPES_LOGIN,
    redirectUri: cfg.redirectUri,
    responseMode: "query",
    state: transaccion.state,
    nonce: transaccion.nonce,
    codeChallenge,
    codeChallengeMethod: "S256",
    prompt: "select_account",
  });

  const res = NextResponse.redirect(url, 303);
  res.cookies.set(COOKIE_LOGIN, await cifrarTransaccion(transaccion), opcionesCookieLogin);
  return res;
});
