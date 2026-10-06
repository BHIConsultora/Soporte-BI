import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import type { Identidad } from "@/servicios/acceso";
import { cifrar, descifrar } from "./cripto";

/** `__Host-` exige Secure, Path=/ y sin Domain: no se puede pisar desde un subdominio. */
export const COOKIE_SESION = "__Host-sbi_sesion";
/** Vence a las 8 h sin actividad (renovación deslizante en `proxy.ts`). */
export const DURACION_SESION_SEGUNDOS = 8 * 60 * 60;
/** Tope absoluto: aunque haya actividad, a las 24 h hay que volver a iniciar sesión. */
export const MAXIMO_SESION_SEGUNDOS = 24 * 60 * 60;
/** Se renueva la cookie si pasaron más de 10 minutos desde la última emisión. */
export const RENOVAR_CADA_SEGUNDOS = 10 * 60;

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
  /** Momento del login (segundos epoch), para el tope absoluto. */
  inicio: z.number().int(),
});

export type Sesion = z.infer<typeof sesionSchema>;
export interface NuevaSesion {
  identidad: Identidad;
  clienteElegidoId: number | null;
  inicio?: number;
}

export const opcionesCookieSesion = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: DURACION_SESION_SEGUNDOS,
} as const;

export async function cifrarSesion(sesion: NuevaSesion, ahora = Date.now()): Promise<string> {
  const { identidad } = sesion;
  const completa: Sesion = {
    identidad: { ...identidad, appRoles: [...identidad.appRoles], grupos: [...identidad.grupos] },
    clienteElegidoId: sesion.clienteElegidoId,
    inicio: sesion.inicio ?? Math.floor(ahora / 1000),
  };
  return cifrar({ ...completa }, "sesion", DURACION_SESION_SEGUNDOS);
}

/** Valida firma, vencimiento (8 h) y tope absoluto (24 h). */
export async function descifrarSesion(token: string, ahora = Date.now()): Promise<(Sesion & { emitida: number }) | null> {
  const payload = await descifrar(token, "sesion");
  if (!payload) return null;
  const parsed = sesionSchema.safeParse(payload);
  if (!parsed.success) return null;
  if (Math.floor(ahora / 1000) - parsed.data.inicio > MAXIMO_SESION_SEGUNDOS) return null;
  return { ...parsed.data, emitida: payload.iat ?? 0 };
}

/** ¿Hay que reemitir la cookie (renovación deslizante)? */
export function debeRenovar(emitida: number, ahora = Date.now()): boolean {
  return Math.floor(ahora / 1000) - emitida > RENOVAR_CADA_SEGUNDOS;
}

export async function leerSesion(): Promise<Sesion | null> {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token) return null;
  const s = await descifrarSesion(token);
  if (!s) return null;
  const { emitida: _e, ...sesion } = s;
  return sesion;
}

/** Solo desde route handlers o server actions. */
export async function guardarSesion(sesion: NuevaSesion): Promise<void> {
  (await cookies()).set(COOKIE_SESION, await cifrarSesion(sesion), opcionesCookieSesion);
}

export async function borrarSesion(): Promise<void> {
  (await cookies()).delete({ name: COOKIE_SESION, path: "/", secure: true });
}
