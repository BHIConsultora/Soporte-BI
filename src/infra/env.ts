import "server-only";
import { z } from "zod";
import { assertDemoModeAllowed, isDemoFlag } from "./demo-guard";

/** Secreto fijo solo para modo demo sin `SESSION_SECRET`: los datos son ficticios. */
const DEMO_SESSION_SECRET = "modo-demo-sin-secreto-no-usar-en-produccion-0000";

const guid = z.uuid();

const realSchema = z.object({
  APP_URL: z.url(),
  SESSION_SECRET: z.string().min(32),
  BHI_TENANT_ID: guid,
  PORTAL_CLIENT_ID: guid,
  DATA_CLIENT_ID: guid,
  SP_SITE_ID: z.string().min(1),
  NOTIFY_MAILBOX: z.email(),
  TEAMS_WEBHOOK_URL: z.url().optional(),
  CRON_SECRET: z.string().min(16),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export type Env =
  | ({ demo: false } & z.infer<typeof realSchema>)
  | { demo: true; APP_URL: string | undefined; SESSION_SECRET: string; CRON_SECRET: string | undefined };

let cached: Env | undefined;

function emptyToUndefined(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v === "" ? undefined : v]));
}

/** Lee y valida las variables del servidor. Falla rápido con un mensaje claro (sin valores). */
export function getEnv(): Env {
  if (cached) return cached;
  const raw = emptyToUndefined(process.env);
  assertDemoModeAllowed(raw);

  if (isDemoFlag(raw)) {
    cached = {
      demo: true,
      APP_URL: raw.APP_URL,
      SESSION_SECRET: raw.SESSION_SECRET && raw.SESSION_SECRET.length >= 32 ? raw.SESSION_SECRET : DEMO_SESSION_SECRET,
      CRON_SECRET: raw.CRON_SECRET,
    };
    return cached;
  }

  const parsed = realSchema.safeParse(raw);
  if (!parsed.success) {
    const campos = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variables de entorno inválidas o faltantes: ${campos}. Ver .env.example.`);
  }
  cached = { demo: false, ...parsed.data };
  return cached;
}

export function isDemoMode(): boolean {
  return getEnv().demo;
}

/** Solo para tests. */
export function resetEnvCache(): void {
  cached = undefined;
}
