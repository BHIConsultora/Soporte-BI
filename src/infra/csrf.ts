import "server-only";

/**
 * Primera barrera CSRF: las mutaciones deben venir del mismo origen.
 * El token de doble envío se suma en la etapa 2 junto con el login real.
 */
export function origenValido(request: Request, appUrl?: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const permitidos = new Set([new URL(request.url).origin]);
  if (appUrl) permitidos.add(new URL(appUrl).origin);
  return permitidos.has(origin);
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
