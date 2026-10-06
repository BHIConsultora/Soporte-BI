import "server-only";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import { z } from "zod";
import { getEnv } from "./env";

/** `__Host-` exige Secure, Path=/ y sin Domain: no se puede pisar desde un subdominio. */
export const COOKIE_SESION = "__Host-sbi_sesion";
const DURACION_SEGUNDOS = 8 * 60 * 60;

const sesionSchema = z.object({
  identidad: z.object({
    oid: z.string().min(1),
    tid: z.string().min(1),
    email: z.string().min(1),
    nombre: z.string(),
    appRoles: z.array(z.string()),
    grupos: z.array(z.string()),
    esInvitado: z.boolean(),
  }),
  clienteElegidoId: z.number().int().nullable(),
});

export type Sesion = z.infer<typeof sesionSchema>;

let claveCache: { secreto: string; clave: Uint8Array } | undefined;

/** Deriva una clave AES-256 del secreto (SHA-256) para `dir` + `A256GCM`. */
async function clave(): Promise<Uint8Array> {
  const secreto = getEnv().SESSION_SECRET;
  if (claveCache?.secreto === secreto) return claveCache.clave;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secreto));
  claveCache = { secreto, clave: new Uint8Array(digest) };
  return claveCache.clave;
}

export async function cifrarSesion(sesion: Sesion): Promise<string> {
  return new EncryptJWT({ ...sesion })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .encrypt(await clave());
}

export async function descifrarSesion(token: string): Promise<Sesion | null> {
  try {
    const { payload } = await jwtDecrypt(token, await clave(), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    const parsed = sesionSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function leerSesion(): Promise<Sesion | null> {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  return token ? descifrarSesion(token) : null;
}

/** Solo desde route handlers o server actions. */
export async function guardarSesion(sesion: Sesion): Promise<void> {
  (await cookies()).set(COOKIE_SESION, await cifrarSesion(sesion), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SEGUNDOS,
  });
}

export async function borrarSesion(): Promise<void> {
  (await cookies()).delete({ name: COOKIE_SESION, path: "/", secure: true });
}
