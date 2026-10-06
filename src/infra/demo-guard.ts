/**
 * El modo demo carga datos ficticios y una sesión simulada: nunca puede llegar a producción.
 * Se usa en `next.config.ts` (falla el build) y en `env.ts` (falla en runtime).
 * Sin dependencias para poder importarlo desde la configuración de Next.
 */
export function isDemoFlag(env: Record<string, string | undefined>): boolean {
  return env.DEMO_MODE === "true";
}

export function assertDemoModeAllowed(env: Record<string, string | undefined>): void {
  if (isDemoFlag(env) && env.VERCEL_ENV === "production") {
    throw new Error("DEMO_MODE=true no está permitido con VERCEL_ENV=production. Quitá la variable en Vercel.");
  }
}
