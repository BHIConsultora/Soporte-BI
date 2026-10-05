import type { PublicClientApplication, AccountInfo } from "@azure/msal-browser";

export const clientId = import.meta.env["VITE_ENTRA_CLIENT_ID"] as string | undefined;
export const authority = "https://login.microsoftonline.com/organizations";
export const loginScopes = ["openid", "profile", "email"];
export const apiScope = import.meta.env["VITE_API_SCOPE"] as string | undefined;

/** Modo de prueba: sin API configurada se simula todo (login incluido). */
export const isMockMode = !import.meta.env["VITE_API_BASE"];

let pca: PublicClientApplication | null = null;

export async function getMsal(): Promise<PublicClientApplication> {
  if (pca) return pca;
  const { PublicClientApplication } = await import("@azure/msal-browser");
  pca = new PublicClientApplication({
    auth: { clientId: clientId ?? "", authority, redirectUri: window.location.origin },
    cache: { cacheLocation: "localStorage" },
  });
  await pca.initialize();
  return pca;
}

export function getMsalSync() {
  return pca;
}

function activeAccount(app: PublicClientApplication): AccountInfo | null {
  return app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
}

/** Devuelve el token para la API (silencioso, con redirect de respaldo). */
export async function getApiToken(): Promise<string> {
  const app = await getMsal();
  const account = activeAccount(app);
  const scopes = apiScope ? [apiScope] : loginScopes;
  if (!account) {
    await app.acquireTokenRedirect({ scopes });
    throw new Error("Redirigiendo para iniciar sesión…");
  }
  try {
    const res = await app.acquireTokenSilent({ scopes, account });
    return res.accessToken;
  } catch {
    await app.acquireTokenRedirect({ scopes, account });
    throw new Error("Redirigiendo para iniciar sesión…");
  }
}
