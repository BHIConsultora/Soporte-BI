import "server-only";
import { isDemoMode } from "@/infra/env";
import type { Repositorio } from "./tipos";

/**
 * El repositorio demo vive en memoria del proceso. Next empaqueta por separado las páginas
 * y los route handlers (cada uno con su copia de este módulo), así que la instancia se
 * guarda en `globalThis` para que todos vean los mismos datos.
 */
const CLAVE = Symbol.for("soporte-bi.repositorio-demo");
type ConRepo = typeof globalThis & { [CLAVE]?: Promise<Repositorio> };
const global = globalThis as ConRepo;

/**
 * Devuelve el repositorio activo. Los datos demo se importan dinámicamente,
 * así que solo se cargan cuando `DEMO_MODE=true`.
 */
export function getRepositorio(): Promise<Repositorio> {
  if (!isDemoMode()) return Promise.reject(new Error("SharePointRepo todavía no está implementado (etapa 3)."));
  global[CLAVE] ??= import("./demo").then((m) => m.crearDemoRepo());
  return global[CLAVE];
}

/** Solo modo demo: vuelve a los datos iniciales (lo usan los tests e2e). */
export function reiniciarRepositorioDemo(): void {
  if (!isDemoMode()) throw new Error("Solo en modo demo");
  delete global[CLAVE];
}
