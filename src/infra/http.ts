import "server-only";
import { NextResponse } from "next/server";
import { log } from "./logger";

export function requestIdDe(request: Request): string {
  return request.headers.get("x-vercel-id")?.slice(0, 64) ?? crypto.randomUUID();
}

/** Errores de la API: `{ error, code?, requestId }`. Nunca detalles internos ni stacks. */
export function errorJson(requestId: string, status: number, error: string, code?: string): NextResponse {
  return NextResponse.json({ error, ...(code ? { code } : {}), requestId }, { status });
}

/** Envuelve un handler: cualquier excepción no prevista se loguea y devuelve 500 genérico. */
export function conManejoDeErrores(
  handler: (request: Request, requestId: string) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const requestId = requestIdDe(request);
    try {
      return await handler(request, requestId);
    } catch (err) {
      // Las redirecciones de Next se implementan con excepciones: hay que dejarlas pasar.
      if (err instanceof Error && "digest" in err && String(err.digest).startsWith("NEXT_")) throw err;
      log("error", "error no manejado", { requestId, nombre: err instanceof Error ? err.name : "desconocido" });
      return errorJson(requestId, 500, "Ocurrió un error inesperado. Probá de nuevo en unos minutos.");
    }
  };
}
