import type { Acceso, Identidad } from "@/servicios/acceso";

/**
 * Caché corta (por instancia) del acceso resuelto, para no leer SharePoint en cada request.
 * Dura poco a propósito (≤ 5 min): una baja de referente, líder o cliente impacta enseguida.
 * Las decisiones de "denegado" no se cachean (si el admin habilita, entra al toque).
 */
const MAX_ENTRADAS = 1000;

interface Entrada {
  acceso: Acceso;
  vence: number;
}

const entradas = new Map<string, Entrada>();

export function claveAcceso(identidad: Pick<Identidad, "tid" | "oid">, clienteElegidoId: number | null): string {
  return `${identidad.tid}:${identidad.oid}:${clienteElegidoId ?? "-"}`;
}

export async function accesoConCache(
  clave: string,
  ttlSegundos: number,
  resolver: () => Promise<Acceso>,
  ahora: () => number = Date.now,
): Promise<Acceso> {
  if (ttlSegundos > 0) {
    const e = entradas.get(clave);
    if (e && e.vence > ahora()) return e.acceso;
  }
  const acceso = await resolver();
  if (ttlSegundos > 0 && acceso.tipo !== "denegado") {
    if (entradas.size >= MAX_ENTRADAS) entradas.delete(entradas.keys().next().value!);
    entradas.set(clave, { acceso, vence: ahora() + ttlSegundos * 1000 });
  }
  return acceso;
}

/** Al iniciar sesión o cambiar de cliente se descarta lo cacheado de esa persona. */
export function invalidarAcceso(identidad: Pick<Identidad, "tid" | "oid">): void {
  const prefijo = `${identidad.tid}:${identidad.oid}:`;
  for (const k of entradas.keys()) if (k.startsWith(prefijo)) entradas.delete(k);
}

/** Solo para tests. */
export function limpiarCacheAcceso(): void {
  entradas.clear();
}
