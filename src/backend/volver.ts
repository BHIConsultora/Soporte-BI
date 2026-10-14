import { rutaInternaSegura } from "@/infra/rutas";

const CLAVE = "sbi_volver";

/** Guarda la ruta a la que volver después del login (sobrevive al viaje a Microsoft). */
export function guardarVolver(ruta: string): void {
  try {
    sessionStorage.setItem(CLAVE, rutaInternaSegura(ruta));
  } catch {
    // Sin storage (modo privado estricto) se vuelve a "/".
  }
}

export function tomarVolver(): string {
  try {
    const ruta = sessionStorage.getItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    return rutaInternaSegura(ruta);
  } catch {
    return "/";
  }
}
