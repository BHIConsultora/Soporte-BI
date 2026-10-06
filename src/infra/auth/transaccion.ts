import "server-only";
import { z } from "zod";
import { aleatorio, cifrar, descifrar } from "../cripto";

/**
 * Datos del inicio de sesión en curso (state, nonce, PKCE y a dónde volver). Viajan en una
 * cookie cifrada de 10 minutos ligada a este navegador: el `state` que vuelve de Microsoft
 * tiene que coincidir, y la URL de retorno (con `?tablero=` del botón de Power BI) sobrevive al login.
 */
export const COOKIE_LOGIN = "__Host-sbi_login";
export const DURACION_LOGIN_SEGUNDOS = 10 * 60;

const transaccionSchema = z.object({
  state: z.string().min(20),
  nonce: z.string().min(20),
  codeVerifier: z.string().min(43).max(128),
  volver: z.string().startsWith("/"),
});
export type TransaccionLogin = z.infer<typeof transaccionSchema>;

export async function nuevaTransaccion(volver: string): Promise<{ transaccion: TransaccionLogin; codeChallenge: string }> {
  const codeVerifier = aleatorio(48);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return {
    transaccion: { state: aleatorio(), nonce: aleatorio(), codeVerifier, volver },
    codeChallenge: Buffer.from(digest).toString("base64url"),
  };
}

export const cifrarTransaccion = (t: TransaccionLogin) => cifrar({ ...t }, "login", DURACION_LOGIN_SEGUNDOS);

export async function descifrarTransaccion(token: string | undefined | null): Promise<TransaccionLogin | null> {
  if (!token) return null;
  const payload = await descifrar(token, "login");
  const r = transaccionSchema.safeParse(payload);
  return r.success ? r.data : null;
}

export const opcionesCookieLogin = {
  httpOnly: true,
  secure: true,
  // Lax: la vuelta desde Microsoft es una navegación GET de primer nivel, así que la cookie viaja.
  sameSite: "lax",
  path: "/",
  maxAge: DURACION_LOGIN_SEGUNDOS,
} as const;
