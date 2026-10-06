import "server-only";
import { getEnv } from "./env";

/**
 * Resuelve el TenantId de un dominio con la metadata pública de Entra ID
 * (`/.well-known/openid-configuration`). En modo demo no sale a internet:
 * devuelve un GUID determinístico derivado del dominio.
 */
export async function resolverTenantPorDominio(dominio: string): Promise<string | null> {
  if (getEnv().demo) return guidDemo(dominio);

  const url = `https://login.microsoftonline.com/${encodeURIComponent(dominio)}/v2.0/.well-known/openid-configuration`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { issuer?: unknown };
  const m = typeof json.issuer === "string" ? /\/([0-9a-f-]{36})\/v2\.0\/?$/i.exec(json.issuer) : null;
  return m?.[1]?.toLowerCase() ?? null;
}

async function guidDemo(dominio: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dominio)));
  const hex = [...h.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Link de consentimiento de administrador para la app Portal (§4.4). */
export function linkConsentimiento(): string | null {
  const env = getEnv();
  if (env.demo) return null;
  const redirect = `${env.APP_URL.replace(/\/+$/, "")}/consentimiento`;
  return `https://login.microsoftonline.com/organizations/adminconsent?client_id=${env.PORTAL_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirect)}`;
}
