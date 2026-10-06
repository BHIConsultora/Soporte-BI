import { conManejoDeErrores, errorJson } from "@/infra/http";

// Callback de OAuth (code + PKCE, `state` y `nonce`): etapa 2.
export const GET = conManejoDeErrores(async (_request, requestId) =>
  errorJson(requestId, 503, "El inicio de sesión con Microsoft todavía no está configurado.", "login_no_configurado"),
);
