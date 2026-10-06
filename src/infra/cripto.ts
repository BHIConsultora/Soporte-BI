import "server-only";
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";
import { getEnv } from "./env";

/**
 * Cifrado simétrico (JWE compacto `dir` + `A256GCM`) para cookies del servidor.
 * Cada uso tiene su propia clave derivada del `SESSION_SECRET` con un "propósito"
 * distinto, así un token de un tipo nunca sirve como otro.
 */
export type Proposito = "sesion" | "login";

const claves = new Map<string, Uint8Array>();

async function clave(proposito: Proposito): Promise<Uint8Array> {
  const secreto = getEnv().SESSION_SECRET;
  const id = `${proposito}:${secreto}`;
  const enCache = claves.get(id);
  if (enCache) return enCache;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`soporte-bi/${proposito}/${secreto}`)));
  if (claves.size > 8) claves.clear();
  claves.set(id, digest);
  return digest;
}

export async function cifrar(payload: JWTPayload, proposito: Proposito, segundos: number): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${segundos}s`)
    .encrypt(await clave(proposito));
}

/** Devuelve el payload (con `iat`/`exp`) o `null` si es inválido, alterado o venció. */
export async function descifrar(token: string, proposito: Proposito): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtDecrypt(token, await clave(proposito), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    return payload;
  } catch {
    return null;
  }
}

/** Valor aleatorio en base64url (estados, nonces, tokens CSRF). */
export function aleatorio(bytes = 32): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}

/** Comparación en tiempo constante. */
export function igualesSeguro(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length || x.length === 0) return false;
  let dif = 0;
  for (let i = 0; i < x.length; i++) dif |= x[i]! ^ y[i]!;
  return dif === 0;
}
