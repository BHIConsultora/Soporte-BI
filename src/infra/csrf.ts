import "server-only";
import { igualesSeguro } from "./cripto";

/**
 * CSRF en dos capas para toda mutación (POST/PATCH/DELETE):
 * 1. `Origin` igual al del portal.
 * 2. Token de doble envío: la cookie `__Host-sbi_csrf` (legible por JS, la pone `proxy.ts`)
 *    tiene que coincidir con el header `x-csrf-token` (fetch) o el campo `csrf` (formularios HTML).
 */
export const COOKIE_CSRF = "__Host-sbi_csrf";
export const HEADER_CSRF = "x-csrf-token";
export const CAMPO_CSRF = "csrf";

export function origenValido(request: Request, appUrl?: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const permitidos = new Set([new URL(request.url).origin]);
  if (appUrl) permitidos.add(new URL(appUrl).origin);
  return permitidos.has(origin);
}

/** Lee una cookie del header `Cookie` de un Request (sirve en route handlers y en tests). */
export function cookieDe(request: Request, nombre: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const parte of header.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Token de doble envío. `enviado` es el header o el campo del formulario. */
export function tokenCsrfValido(request: Request, enviado: string | null | undefined): boolean {
  const esperado = cookieDe(request, COOKIE_CSRF);
  return !!esperado && !!enviado && igualesSeguro(esperado, enviado);
}

/** Verificación completa para mutaciones hechas con fetch (header). */
export function mutacionValida(request: Request, appUrl?: string): boolean {
  return origenValido(request, appUrl) && tokenCsrfValido(request, request.headers.get(HEADER_CSRF));
}

const BASE_INTERNA = "http://interno.invalid";

/** Acepta solo rutas internas (`/algo`), nunca `//host`, `/\host` ni URLs absolutas. */
export function rutaInternaSegura(valor: string | null | undefined, porDefecto = "/"): string {
  if (!valor || !valor.startsWith("/") || valor.length > 2000) return porDefecto;
  try {
    // El parser de URL normaliza `\` a `/`: si cambia el origen, no es una ruta interna.
    const url = new URL(valor, BASE_INTERNA);
    return url.origin === BASE_INTERNA ? url.pathname + url.search + url.hash : porDefecto;
  } catch {
    return porDefecto;
  }
}
