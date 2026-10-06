import type { AdjuntoGuardado } from "@/dominio/entidades";
import type { ContextoAutorizado } from "./acceso";
import { cargarTicketVisible, esBhi } from "./autorizacion";
import type { Deps } from "./deps";
import { noEncontrado } from "./errores";
import { esVisibleParaCliente } from "./tickets";

/**
 * Descarga autorizada: el adjunto hereda el alcance de su ticket. Un cliente además solo
 * puede bajar adjuntos de mensajes que ve (nunca de entradas internas).
 */
export async function descargarAdjunto(
  ctx: ContextoAutorizado,
  { repo }: Pick<Deps, "repo">,
  id: string,
): Promise<{ adjunto: AdjuntoGuardado; datos: Uint8Array }> {
  const archivo = await repo.adjuntos.obtener(id);
  if (!archivo) throw noEncontrado("El archivo");
  const t = await cargarTicketVisible(ctx, repo, archivo.adjunto.ticketItemId).catch(() => {
    throw noEncontrado("El archivo");
  });
  if (!esBhi(ctx)) {
    const visibles = (await repo.historial.listarPorTicket(t.itemId)).filter(esVisibleParaCliente);
    if (!visibles.some((e) => e.adjuntos.some((a) => a.id === id))) throw noEncontrado("El archivo");
  }
  return archivo;
}
