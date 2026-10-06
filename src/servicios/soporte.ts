import { ESTADOS_ABIERTOS } from "@/dominio/catalogos";
import type { CambiosSoporte } from "@/dominio/esquemas";
import { calcularVenceSLA } from "@/dominio/sla";
import type { CambiosTicket, NuevaEntrada } from "@/repositorio/tipos";
import type { ContextoAutorizado } from "./acceso";
import { cargarTicketVisible, exigirSoporte, type ContextoBhi } from "./autorizacion";
import type { Deps } from "./deps";
import { conflicto, noEncontrado } from "./errores";
import { entradaEstado } from "./tickets";

/** Acciones del equipo de BHI (rol Soporte o Admin). Clientes → 404. */

function entradaInterna(ctx: ContextoBhi, ticketItemId: number, fecha: string, tipo: NuevaEntrada["tipo"], texto: string): NuevaEntrada {
  return {
    ticketItemId,
    tipo,
    autor: ctx.identidad.nombre,
    autorEmail: ctx.identidad.email.toLowerCase(),
    autorEsIA: false,
    fecha,
    texto,
    visible: false,
    estadoBorrador: null,
    adjuntos: [],
  };
}

export async function actualizarTicket(ctx: ContextoAutorizado, { repo, ahora }: Deps, itemId: number, cambios: CambiosSoporte): Promise<void> {
  exigirSoporte(ctx);
  const t = await cargarTicketVisible(ctx, repo, itemId);
  const fecha = ahora().toISOString();
  const update: CambiosTicket = {};
  const entradas: NuevaEntrada[] = [];

  if (cambios.estado && cambios.estado !== t.estado) {
    update.estado = cambios.estado;
    if (cambios.estado === "Resuelto") update.fechaResuelto = fecha;
    else if (ESTADOS_ABIERTOS.includes(cambios.estado)) update.fechaResuelto = null;
    // El cambio de estado lo ve el cliente en su línea de tiempo.
    entradas.push(entradaEstado(ctx, t.itemId, fecha, cambios.estado));
  }
  if (cambios.prioridad && cambios.prioridad !== t.prioridad) {
    update.prioridad = cambios.prioridad;
    const feriados = new Set((await repo.feriados.listar()).map((f) => f.fecha));
    update.venceSLA = calcularVenceSLA(new Date(t.fechaAlta), cambios.prioridad, feriados)?.toISOString() ?? null;
    entradas.push(entradaInterna(ctx, t.itemId, fecha, "prioridad", `${t.prioridad} → ${cambios.prioridad}`));
  }
  if (cambios.asignadoA !== undefined && cambios.asignadoA !== t.asignadoA) {
    update.asignadoA = cambios.asignadoA;
    entradas.push(entradaInterna(ctx, t.itemId, fecha, "asignacion", cambios.asignadoA ?? "Sin asignar"));
  }
  if (entradas.length === 0) return;

  for (const e of entradas) await repo.historial.agregar(e);
  await repo.tickets.actualizar(t.itemId, { ...update, ultimaActualizacion: fecha });
}

export async function tomarTicket(ctx: ContextoAutorizado, deps: Deps, itemId: number): Promise<void> {
  exigirSoporte(ctx);
  await actualizarTicket(ctx, deps, itemId, { asignadoA: ctx.identidad.email.toLowerCase() });
}

export async function agregarNotaInterna(ctx: ContextoAutorizado, { repo, ahora }: Deps, itemId: number, texto: string): Promise<void> {
  exigirSoporte(ctx);
  const t = await cargarTicketVisible(ctx, repo, itemId);
  await repo.historial.agregar(entradaInterna(ctx, t.itemId, ahora().toISOString(), "nota_interna", texto));
}

async function cargarBorradorPendiente(ctx: ContextoBhi, { repo }: Pick<Deps, "repo">, itemId: number, borradorId: number) {
  const t = await cargarTicketVisible(ctx, repo, itemId);
  const b = await repo.historial.obtener(borradorId);
  // El borrador tiene que pertenecer a ESTE ticket y ser un borrador.
  if (!b || b.ticketItemId !== t.itemId || b.tipo !== "borrador_respuesta") throw noEncontrado("El borrador");
  if (b.estadoBorrador !== "pendiente") throw conflicto("Este borrador ya fue publicado o descartado.", "borrador_no_pendiente");
  return { t, b };
}

/** Publica (con el texto editado por soporte) como comentario visible del humano que publica. */
export async function publicarBorrador(
  ctx: ContextoAutorizado,
  deps: Deps,
  itemId: number,
  borradorId: number,
  texto: string,
): Promise<void> {
  exigirSoporte(ctx);
  const { repo, ahora, notificador } = deps;
  const { t, b } = await cargarBorradorPendiente(ctx, deps, itemId, borradorId);
  const fecha = ahora().toISOString();
  await repo.historial.actualizar(b.id, { estadoBorrador: "publicado", texto });
  await repo.historial.agregar({ ...entradaInterna(ctx, t.itemId, fecha, "comentario", texto), visible: true });
  const actualizado = await repo.tickets.actualizar(t.itemId, { ultimaActualizacion: fecha });
  await notificador.respuestaPublicada(actualizado, texto);
}

export async function descartarBorrador(ctx: ContextoAutorizado, deps: Deps, itemId: number, borradorId: number): Promise<void> {
  exigirSoporte(ctx);
  const { b } = await cargarBorradorPendiente(ctx, deps, itemId, borradorId);
  await deps.repo.historial.actualizar(b.id, { estadoBorrador: "descartado" });
}
