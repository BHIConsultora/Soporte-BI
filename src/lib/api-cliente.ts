/** Cliente HTTP mínimo para los componentes del navegador. Mismo origen, cookie de sesión. */

export type ResultadoApi<T> = { ok: true; datos: T } | { ok: false; error: string; code?: string; status: number };

interface Opciones {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  form?: FormData;
}

/** Token de doble envío: la cookie `__Host-sbi_csrf` (la pone el servidor) va también en un header. */
function tokenCsrf(): string {
  const m = /(?:^|;\s*)__Host-sbi_csrf=([^;]+)/.exec(document.cookie);
  return m?.[1] ? decodeURIComponent(m[1]) : "";
}

export async function llamarApi<T = unknown>(url: string, { method = "GET", json, form }: Opciones = {}): Promise<ResultadoApi<T>> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: {
        ...(json !== undefined && { "Content-Type": "application/json" }),
        ...(method !== "GET" && { "x-csrf-token": tokenCsrf() }),
      },
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
    });
    const texto = await res.text();
    const cuerpo: unknown = texto ? JSON.parse(texto) : null;
    if (res.ok) return { ok: true, datos: cuerpo as T };
    const e = (cuerpo ?? {}) as { error?: string; code?: string };
    return { ok: false, error: e.error ?? mensajePorStatus(res.status), code: e.code, status: res.status };
  } catch {
    return { ok: false, error: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.", status: 0 };
  }
}

function mensajePorStatus(status: number): string {
  if (status === 401) return "Tu sesión venció. Volvé a iniciar sesión.";
  if (status === 413) return "Los archivos son demasiado grandes.";
  return "Algo salió mal. Probá de nuevo.";
}
