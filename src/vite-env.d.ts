/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `true` = datos ficticios y sesión simulada (solo desarrollo/preview). */
  readonly VITE_DEMO_MODE?: string;
  /** Los carga Lovable Cloud al conectar Supabase. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
