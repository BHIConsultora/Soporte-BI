import { NextResponse } from "next/server";
import { configAuth, SCOPES_LOGIN } from "@/infra/auth/config";
import { destinoPorError, urlPorDestino } from "@/infra/auth/errores-entra";
import { gruposPorOverage } from "@/infra/auth/grupos";
import { validarIdToken } from "@/infra/auth/id-token";
import { iniciarSesion } from "@/infra/auth/iniciar";
import { clientePortal } from "@/infra/auth/msal";
import { COOKIE_LOGIN, descifrarTransaccion } from "@/infra/auth/transaccion";
import { cookieDe } from "@/infra/csrf";
import { igualesSeguro } from "@/infra/cripto";
import { conManejoDeErrores } from "@/infra/http";
import { log } from "@/infra/logger";
import { getRepositorio } from "@/repositorio";

/** Vuelta desde Microsoft: valida `state`, canjea el código (PKCE), valida el ID token y crea la sesión. */
export const GET = conManejoDeErrores(async (request, requestId) => {
  const sp = new URL(request.url).searchParams;
  const ir = (ruta: string) => {
    const res = NextResponse.redirect(new URL(ruta, request.url), 303);
    // La transacción es de un solo uso.
    res.cookies.delete({ name: COOKIE_LOGIN, path: "/", secure: true });
    return res;
  };

  const cfg = configAuth();
  if (!cfg) return ir("/bienvenida?error=login");

  const tx = await descifrarTransaccion(cookieDe(request, COOKIE_LOGIN));
  const state = sp.get("state");
  if (!tx || !state || !igualesSeguro(state, tx.state)) {
    log("warn", "callback con state inválido o vencido", { requestId });
    return ir("/bienvenida?error=vencido");
  }

  const error = sp.get("error");
  if (error) {
    const destino = destinoPorError(error, sp.get("error_description"));
    log("warn", "login rechazado por Entra", { requestId, destino, error: error.slice(0, 50) });
    return ir(urlPorDestino(destino));
  }

  const code = sp.get("code");
  if (!code) return ir("/bienvenida?error=login");

  let idToken: string;
  try {
    const r = await clientePortal(cfg).acquireTokenByCode({
      code,
      scopes: SCOPES_LOGIN,
      redirectUri: cfg.redirectUri,
      codeVerifier: tx.codeVerifier,
      nonce: tx.nonce,
      state: tx.state,
    });
    idToken = r.idToken;
  } catch (err) {
    const texto = err instanceof Error ? err.message : "";
    const destino = destinoPorError((err as { errorCode?: string }).errorCode, texto);
    log("warn", "falló el canje del código", { requestId, destino, codigo: (err as { errorCode?: string }).errorCode ?? null });
    return ir(urlPorDestino(destino));
  }

  // La identidad sale solo del ID token validado por nosotros (firma, emisor por tid, audiencia, nonce).
  let validado: Awaited<ReturnType<typeof validarIdToken>>;
  try {
    validado = await validarIdToken(idToken, { clientId: cfg.clientId, nonce: tx.nonce });
  } catch (err) {
    log("warn", "ID token rechazado", { requestId, motivo: err instanceof Error ? err.message : "desconocido" });
    return ir("/bienvenida?error=login");
  }
  const { identidad, gruposIncompletos } = validado;
  if (gruposIncompletos && identidad.tid === cfg.bhiTenantId) {
    const satelites = (await (await getRepositorio()).clientes.listar()).flatMap((c) => (c.tipo === "satelite" && c.grupoId ? [c.grupoId] : []));
    identidad.grupos = await gruposPorOverage(identidad.oid, satelites);
  }

  await iniciarSesion({ identidad, clienteElegidoId: null });
  log("info", "inicio de sesión", { requestId, tid: identidad.tid });
  return ir(tx.volver);
});
