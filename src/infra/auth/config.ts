import "server-only";
import { DEMO_BHI_TENANT_ID } from "@/repositorio/demo/constantes";
import { getEnv } from "../env";

export const AUTORIDAD = "https://login.microsoftonline.com/organizations";
export const SCOPES_LOGIN = ["openid", "profile", "email"];

export interface ConfigAuth {
  clientId: string;
  bhiTenantId: string;
  appUrl: string;
  redirectUri: string;
}

/**
 * Configuración del login con Microsoft, o `null` si no está cargada.
 * En producción siempre está (lo exige `env.ts`). En modo demo es opcional: si están
 * las variables, el preview ofrece además el login real (resuelto contra los datos demo).
 */
export function configAuth(): ConfigAuth | null {
  const env = getEnv();
  if (!env.PORTAL_CLIENT_ID || !env.BHI_TENANT_ID || !env.APP_URL) return null;
  return {
    clientId: env.PORTAL_CLIENT_ID,
    bhiTenantId: env.BHI_TENANT_ID,
    appUrl: env.APP_URL,
    redirectUri: `${env.APP_URL}/api/auth/callback`,
  };
}

/** Tenants que cuentan como "BHI" para la resolución de rol. */
export function bhiTenantIds(): string[] {
  const env = getEnv();
  const ids = env.demo ? [DEMO_BHI_TENANT_ID] : [];
  if (env.BHI_TENANT_ID) ids.push(env.BHI_TENANT_ID);
  return ids;
}
