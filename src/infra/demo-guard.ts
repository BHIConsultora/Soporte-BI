/**
 * El modo demo carga datos ficticios y una sesión simulada: nunca puede convivir con el backend real.
 * Se usa en `vite.config.ts` (falla el build) y en `env.ts` (falla en runtime).
 * Sin dependencias para poder importarlo desde la configuración de Vite.
 */
export function isDemoFlag(env: Record<string, string | boolean | undefined>): boolean {
  return env.VITE_DEMO_MODE === "true";
}

/**
 * Lovable Cloud carga `VITE_SUPABASE_URL` al conectar el backend: si para entonces
 * `VITE_DEMO_MODE` sigue en `true`, el build se corta en vez de publicar datos ficticios.
 */
export function assertDemoModeAllowed(env: Record<string, string | boolean | undefined>): void {
  if (isDemoFlag(env) && env.VITE_SUPABASE_URL) {
    throw new Error("VITE_DEMO_MODE=true no puede convivir con VITE_SUPABASE_URL. Quitá VITE_DEMO_MODE.");
  }
}
