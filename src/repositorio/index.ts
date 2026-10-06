import "server-only";
import { isDemoMode } from "@/infra/env";
import type { Repositorio } from "./tipos";

let instancia: Promise<Repositorio> | undefined;

/**
 * Devuelve el repositorio activo. Los datos demo se importan dinámicamente,
 * así que solo se cargan cuando `DEMO_MODE=true`.
 */
export function getRepositorio(): Promise<Repositorio> {
  instancia ??= isDemoMode()
    ? import("./demo").then((m) => m.crearDemoRepo())
    : Promise.reject(new Error("SharePointRepo todavía no está implementado (etapa 3)."));
  return instancia;
}
