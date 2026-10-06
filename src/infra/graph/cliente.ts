import "server-only";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { clientAssertion } from "../auth/credencial";
import { requerirVariable } from "../env";

/**
 * Cliente mínimo de Microsoft Graph (app "Soporte BI – Datos", app-only, sin SDK).
 * - Token de app con MSAL + credencial federada de Vercel (MSAL lo cachea y renueva).
 * - Reintentos ante 429/503/504 respetando `Retry-After`, con backoff exponencial y tope.
 * - Paginación por `@odata.nextLink`.
 * Ningún componente ni handler lo usa directo: solo `SharePointRepo`, `Mailer` y `Notifier`.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPE = ["https://graph.microsoft.com/.default"];

export class ErrorGraph extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string | null,
  ) {
    // Nunca se incluye el cuerpo de la respuesta: puede traer datos.
    super(`Graph respondió ${status}${codigo ? ` (${codigo})` : ""}`);
    this.name = "ErrorGraph";
  }
}

let cca: ConfidentialClientApplication | undefined;

async function tokenApp(): Promise<string> {
  cca ??= new ConfidentialClientApplication({
    auth: {
      clientId: requerirVariable("DATA_CLIENT_ID"),
      authority: `https://login.microsoftonline.com/${requerirVariable("BHI_TENANT_ID")}`,
      clientAssertion: () => clientAssertion(),
    },
  });
  const r = await cca.acquireTokenByClientCredential({ scopes: SCOPE });
  if (!r?.accessToken) throw new Error("No se obtuvo token de Graph");
  return r.accessToken;
}

export interface OpcionesGraph {
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  token?: () => Promise<string>;
  maxReintentos?: number;
}

const esperarReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const REINTENTABLES = new Set([429, 503, 504]);

/** Milisegundos a esperar: `Retry-After` (segundos o fecha) o backoff exponencial con jitter. */
export function demoraReintento(intento: number, retryAfter: string | null, ahora = Date.now()): number {
  if (retryAfter) {
    const seg = Number(retryAfter);
    if (Number.isFinite(seg)) return Math.min(Math.max(seg, 0) * 1000, 60_000);
    const fecha = Date.parse(retryAfter);
    if (!Number.isNaN(fecha)) return Math.min(Math.max(fecha - ahora, 0), 60_000);
  }
  return Math.min(500 * 2 ** intento, 8_000) + Math.floor(Math.random() * 250);
}

export async function graph<T>(ruta: string, init: RequestInit = {}, opciones: OpcionesGraph = {}): Promise<T> {
  const { fetch: f = fetch, esperar = esperarReal, token = tokenApp, maxReintentos = 4 } = opciones;
  const url = ruta.startsWith("https://") ? ruta : `${GRAPH}${ruta}`;
  if (!url.startsWith(`${GRAPH}/`)) throw new Error("URL de Graph inválida");

  for (let intento = 0; ; intento++) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${await token()}`);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const res = await f(url, { ...init, headers, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(20_000) });

    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }
    if (REINTENTABLES.has(res.status) && intento < maxReintentos) {
      await esperar(demoraReintento(intento, res.headers.get("Retry-After")));
      continue;
    }
    let codigo: string | null = null;
    try {
      codigo = ((await res.json()) as { error?: { code?: string } }).error?.code ?? null;
    } catch {
      codigo = null;
    }
    throw new ErrorGraph(res.status, codigo);
  }
}

/** Recorre todas las páginas (`@odata.nextLink`) con un tope de seguridad. */
export async function graphTodas<T>(ruta: string, opciones: OpcionesGraph = {}, maxPaginas = 50): Promise<T[]> {
  const items: T[] = [];
  let siguiente: string | undefined = ruta;
  for (let i = 0; siguiente && i < maxPaginas; i++) {
    const r: { value: T[]; "@odata.nextLink"?: string } = await graph(siguiente, {}, opciones);
    items.push(...r.value);
    siguiente = r["@odata.nextLink"];
  }
  return items;
}
