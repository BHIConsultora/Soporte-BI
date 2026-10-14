import { isDemoMode } from "@/infra/env";
import type { Backend } from "./tipos";

let instancia: Promise<Backend> | undefined;

/**
 * Devuelve el backend activo. Cada implementación se importa dinámicamente: en modo demo
 * no se carga Supabase y, fuera de él, los datos ficticios no se descargan.
 */
export function getBackend(): Promise<Backend> {
  instancia ??= isDemoMode()
    ? import("./demo").then((m) => m.crearBackendDemo())
    : import("./supabase").then((m) => m.crearBackendSupabase());
  return instancia;
}

export type { Backend, PersonaDemo } from "./tipos";
