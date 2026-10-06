import { NextResponse, type NextRequest } from "next/server";
import { aleatorio } from "./infra/cripto";
import { COOKIE_CSRF } from "./infra/csrf";
import { cifrarSesion, COOKIE_SESION, debeRenovar, descifrarSesion, opcionesCookieSesion } from "./infra/sesion";

/**
 * Corre antes de cada página (no en la API ni en estáticos):
 * - CSP con nonce por request (las páginas son dinámicas: el layout lee `x-nonce`).
 * - `x-url`: la URL pedida, para volver a ella después del login.
 * - Cookie CSRF de doble envío si falta (también se inyecta en el request para que la vea la página).
 * - Renovación deslizante de la sesión (8 h sin actividad, tope de 24 h).
 * El resto de los headers de seguridad está en `next.config.ts`.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // En desarrollo el HMR inyecta <style> sin nonce; en producción no hace falta.
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // React escribe atributos `style` (p. ej. el arrastre del kanban); no ejecutan código.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://login.microsoftonline.com",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-url", request.nextUrl.pathname + request.nextUrl.search);
  requestHeaders.set("Content-Security-Policy", csp);

  const csrfNuevo = request.cookies.get(COOKIE_CSRF)?.value ? null : aleatorio();
  if (csrfNuevo) {
    const previas = request.headers.get("cookie");
    requestHeaders.set("cookie", `${previas ? `${previas}; ` : ""}${COOKIE_CSRF}=${csrfNuevo}`);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  if (csrfNuevo) {
    response.cookies.set(COOKIE_CSRF, csrfNuevo, { httpOnly: false, secure: true, sameSite: "lax", path: "/" });
  }

  const token = request.cookies.get(COOKIE_SESION)?.value;
  if (token) {
    const sesion = await descifrarSesion(token);
    if (!sesion) {
      response.cookies.delete({ name: COOKIE_SESION, path: "/", secure: true });
    } else if (debeRenovar(sesion.emitida)) {
      const { emitida: _e, ...datos } = sesion;
      response.cookies.set(COOKIE_SESION, await cifrarSesion(datos), opcionesCookieSesion);
    }
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
