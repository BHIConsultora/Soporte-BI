import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Cliente de Supabase (Lovable Cloud). Las variables las carga Lovable al conectar el backend.
 * La clave publicable es pública por diseño: la seguridad está en RLS (supabase/migrations/).
 * Solo se importa fuera del modo demo (`src/backend/index.ts` lo carga con `import()`).
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (o VITE_DEMO_MODE=true). Ver .env.example.");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // El login de Microsoft vuelve a /auth/callback con `?code=` (PKCE) y supabase-js lo canjea solo.
    flowType: "pkce",
    detectSessionInUrl: true,
  },
});
