import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ArchivoEntrante } from "@/dominio/adjuntos";
import { MAX_BYTES_REQUEST } from "@/dominio/adjuntos";
import { parseTicketId } from "@/dominio/ticket-id";
import { getRepositorio } from "@/repositorio";
import type { ContextoAutorizado } from "@/servicios/acceso";
import { notificadorNulo, type Deps } from "@/servicios/deps";
import { ErrorServicio, noEncontrado } from "@/servicios/errores";
import { obtenerContexto } from "./contexto";
import { mutacionValida } from "./csrf";
import { getEnv } from "./env";
import { errorJson, requestIdDe } from "./http";
import { log } from "./logger";

export async function getDeps(): Promise<Deps> {
  return { repo: await getRepositorio(), notificador: notificadorNulo, ahora: () => new Date() };
}

interface ArgsHandler<P> {
  request: Request;
  requestId: string;
  ctx: ContextoAutorizado;
  deps: Deps;
  params: P;
}

/**
 * Envuelve un route handler: requestId, verificación de `Origin` en mutaciones,
 * sesión + acceso recalculado (401/403/409) y traducción de errores a `{ error, code, requestId }`.
 */
export function rutaApi<P extends Record<string, string> = Record<string, never>>(
  handler: (args: ArgsHandler<P>) => Promise<Response>,
  { mutacion = false }: { mutacion?: boolean } = {},
) {
  return async (request: Request, segmento: { params: Promise<P> }): Promise<Response> => {
    const requestId = requestIdDe(request);
    try {
      if (mutacion && !mutacionValida(request, getEnv().APP_URL)) {
        return errorJson(requestId, 403, "La página venció o el pedido no vino del portal. Recargala y probá de nuevo.", "csrf");
      }
      const contexto = await obtenerContexto();
      if (!contexto) return errorJson(requestId, 401, "Tenés que iniciar sesión.");
      const { identidad, acceso } = contexto;
      if (acceso.tipo === "denegado") return errorJson(requestId, 403, "Tu cuenta no está habilitada.", acceso.code);
      if (acceso.tipo === "elegir_cliente") return errorJson(requestId, 409, "Elegí con qué cliente vas a trabajar.", "elegir_cliente");

      return await handler({ request, requestId, ctx: { identidad, acceso }, deps: await getDeps(), params: await segmento.params });
    } catch (err) {
      if (err instanceof ErrorServicio) return errorJson(requestId, err.status, err.message, err.code);
      if (err instanceof z.ZodError) return errorJson(requestId, 422, err.issues[0]?.message ?? "Datos inválidos.", "datos_invalidos");
      log("error", "error no manejado en la API", { requestId, nombre: err instanceof Error ? err.name : "desconocido" });
      return errorJson(requestId, 500, "Ocurrió un error inesperado. Probá de nuevo en unos minutos.");
    }
  };
}

const MAX_JSON = 64 * 1024;

function verificarTamano(request: Request, max: number) {
  const largo = Number(request.headers.get("content-length") ?? "0");
  if (largo > max) throw new ErrorServicio(413, "El pedido es demasiado grande.", "request_muy_grande");
}

export async function leerJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  verificarTamano(request, MAX_JSON);
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    throw new ErrorServicio(422, "El cuerpo del pedido no es JSON válido.", "datos_invalidos");
  }
  return schema.parse(cuerpo);
}

/** Multipart: campos de texto + archivos del campo `adjuntos`. */
export async function leerMultipart(request: Request): Promise<{ campos: Record<string, string>; archivos: ArchivoEntrante[] }> {
  // Margen para los separadores y campos de texto del multipart.
  verificarTamano(request, MAX_BYTES_REQUEST + 512 * 1024);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ErrorServicio(422, "No se pudo leer el formulario.", "datos_invalidos");
  }
  const campos: Record<string, string> = {};
  const archivos: ArchivoEntrante[] = [];
  for (const [clave, valor] of form.entries()) {
    if (typeof valor === "string") campos[clave] = valor;
    else if (clave === "adjuntos" && valor.size > 0) archivos.push({ nombre: valor.name, datos: new Uint8Array(await valor.arrayBuffer()) });
  }
  return { campos, archivos };
}

export function idDeTicket(valor: string): number {
  const id = parseTicketId(valor);
  if (id === null) throw noEncontrado();
  return id;
}

export const ok = (datos: unknown = { ok: true }, status = 200) => NextResponse.json(datos, { status });
