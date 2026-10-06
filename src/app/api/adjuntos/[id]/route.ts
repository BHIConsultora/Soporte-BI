import { rutaApi } from "@/infra/api";
import { descargarAdjunto } from "@/servicios/adjuntos";
import { noEncontrado } from "@/servicios/errores";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Proxy autorizado: siempre como descarga y sin dejar que el navegador adivine el tipo. */
export const GET = rutaApi<{ id: string }>(async ({ ctx, deps, params }) => {
  if (!UUID.test(params.id)) throw noEncontrado("El archivo");
  const { adjunto, datos } = await descargarAdjunto(ctx, deps, params.id);
  return new Response(new Blob([datos as BlobPart], { type: adjunto.tipo }), {
    headers: {
      "Content-Type": adjunto.tipo,
      "Content-Disposition": `attachment; filename="adjunto"; filename*=UTF-8''${encodeURIComponent(adjunto.nombre)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});
