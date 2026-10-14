/**
 * CSP del build de producción. Va en un `<meta>` porque el hosting de Lovable no deja
 * configurar headers; por eso no incluye `frame-ancestors` (los navegadores lo ignoran en `<meta>`).
 * En desarrollo no se aplica: el HMR de Vite inyecta scripts y estilos inline.
 */
export function buildCsp(supabaseUrl?: string): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : null;
  const ws = supabase?.replace(/^http/, "ws");
  const extra = (...v: (string | null | undefined)[]) => v.filter(Boolean).map((x) => ` ${x}`).join("");
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    // React y Radix escriben atributos `style` (posiciones de popovers); no ejecutan código.
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' blob: data:${extra(supabase)}`,
    "font-src 'self' data:",
    `connect-src 'self'${extra(supabase, ws)}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}
