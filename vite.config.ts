import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { buildCsp } from "./src/infra/csp.ts";
import { assertDemoModeAllowed } from "./src/infra/demo-guard.ts";

/** Agrega la CSP como `<meta>` solo en el build (ver `src/infra/csp.ts`). */
function csp(supabaseUrl: string | undefined): Plugin {
  return {
    name: "soporte-bi:csp",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: buildCsp(supabaseUrl) }, injectTo: "head-prepend" },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Corta el build si quedó el modo demo encendido con el backend real configurado.
  assertDemoModeAllowed(env);

  return {
    // Puerto que usa el preview de Lovable.
    server: { host: "::", port: 8080 },
    plugins: [react(), tailwindcss(), csp(env.VITE_SUPABASE_URL)],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  };
});
