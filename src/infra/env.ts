import "server-only";
import { z } from "zod";
import { assertDemoModeAllowed, isDemoFlag } from "./demo-guard";

/** Secreto fijo solo para modo demo sin `SESSION_SECRET`: los datos son ficticios. */
const DEMO_SESSION_SECRET = "modo-demo-sin-secreto-no-usar-en-produccion-0000";

const guid = z.uuid().transform((v) => v.toLowerCase());
const opcional = <T extends z.ZodType>(s: T) => s.optional();

/** Variables que pueden estar en cualquier modo (en demo habilitan el login real de prueba). */
const comunes = {
  APP_URL: opcional(z.url().transform((u) => u.replace(/\/+$/, ""))),
  BHI_TENANT_ID: opcional(guid),
  PORTAL_CLIENT_ID: opcional(guid),
  DATA_CLIENT_ID: opcional(guid),
  SP_SITE_ID: opcional(z.string().min(1)),
  NOTIFY_MAILBOX: opcional(z.email()),
  TEAMS_WEBHOOK_URL: opcional(z.url()),
  CRON_SECRET: opcional(z.string().min(16)),
  ANTHROPIC_API_KEY: opcional(z.string().min(1)),
  /** Segundos de caché del rol/acceso por usuario (≤ 300). Por defecto 120; en demo 0. */
  ACCESO_CACHE_SEGUNDOS: opcional(z.coerce.number().int().min(0).max(300)),
};

const demoSchema = z.object({ ...comunes, SESSION_SECRET: opcional(z.string().min(32)) });

/**
 * Producción: lo mínimo para el login real es obligatorio. Las demás variables se validan
 * donde se usan (SharePoint en la etapa 3, correo y cron en la 4), con un error claro.
 */
const realSchema = z.object({
  ...comunes,
  APP_URL: z.url().transform((u) => u.replace(/\/+$/, "")),
  SESSION_SECRET: z.string().min(32),
  BHI_TENANT_ID: guid,
  PORTAL_CLIENT_ID: guid,
});

export type Env = z.infer<typeof demoSchema> & { demo: boolean; SESSION_SECRET: string };

let cached: Env | undefined;

function emptyToUndefined(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v === "" ? undefined : v]));
}

function fallar(error: z.ZodError): never {
  const campos = error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Variables de entorno inválidas o faltantes: ${campos}. Ver .env.example.`);
}

/** Lee y valida las variables del servidor. Falla rápido con un mensaje claro (sin valores). */
export function getEnv(): Env {
  if (cached) return cached;
  const raw = emptyToUndefined(process.env);
  assertDemoModeAllowed(raw);

  if (isDemoFlag(raw)) {
    const r = demoSchema.safeParse(raw);
    if (!r.success) fallar(r.error);
    cached = { ...r.data, demo: true, SESSION_SECRET: r.data.SESSION_SECRET ?? DEMO_SESSION_SECRET };
    return cached;
  }

  const r = realSchema.safeParse(raw);
  if (!r.success) fallar(r.error);
  cached = { ...r.data, demo: false };
  return cached;
}

export function isDemoMode(): boolean {
  return getEnv().demo;
}

/** Exige una variable opcional en el punto donde se usa. */
export function requerirVariable<K extends keyof Env>(nombre: K): NonNullable<Env[K]> {
  const valor = getEnv()[nombre];
  if (valor === undefined || valor === null) throw new Error(`Falta la variable de entorno ${String(nombre)}. Ver docs/DEPLOY.md.`);
  return valor as NonNullable<Env[K]>;
}

/** Solo para tests. */
export function resetEnvCache(): void {
  cached = undefined;
}
