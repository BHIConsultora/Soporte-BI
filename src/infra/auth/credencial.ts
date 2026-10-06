import "server-only";
import { getVercelOidcToken } from "@vercel/oidc";

/**
 * Credencial de las apps de Entra ID sin secretos: el token OIDC que Vercel emite para
 * cada función se usa como `client_assertion` (workload identity federation). Entra confía
 * en él por la credencial federada configurada en cada app (ver docs/DEPLOY.md §3).
 *
 * En local: `vercel env pull` deja `VERCEL_OIDC_TOKEN` (dura ~12 h) y la librería lo renueva
 * si el proyecto está vinculado con `vercel link`.
 */
export async function clientAssertion(): Promise<string> {
  try {
    return await getVercelOidcToken();
  } catch (err) {
    throw new Error(
      `No hay token OIDC de Vercel para autenticar la app ante Entra ID (${err instanceof Error ? err.name : "desconocido"}). ` +
        "En Vercel: habilitar OIDC Federation en el proyecto. En local: `vercel link` y `vercel env pull`.",
    );
  }
}
