import { assertDemoModeAllowed, isDemoFlag } from "./demo-guard";

/**
 * Variables públicas (todas `VITE_*`: terminan en el bundle del navegador, nunca secretos).
 * Las de Supabase las valida `src/integrations/supabase/client.ts`.
 */
export function isDemoMode(): boolean {
  assertDemoModeAllowed(import.meta.env);
  return isDemoFlag(import.meta.env);
}
