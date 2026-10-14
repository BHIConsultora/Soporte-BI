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
