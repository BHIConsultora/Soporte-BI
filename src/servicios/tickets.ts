import { TZDate } from "@date-fns/tz";
import { DIAS_PARA_REABRIR, ESTADOS_ABIERTOS, PRIORIDAD_INICIAL, TIPOS_HISTORIAL_INTERNOS, type Estado } from "@/dominio/catalogos";
import { validarAdjuntos, MENSAJE_ERROR_ADJUNTO, type ArchivoEntrante } from "@/dominio/adjuntos";
import type {
  AdjuntoDTO,
  EntradaCliente,
  EntradaSoporte,
  ResumenTickets,
  TicketCliente,
  TicketDetalleCliente,
  TicketDetalleSoporte,
  TicketKanban,
  TicketSoporte,
} from "@/dominio/dto";
import type { Adjunto, Cliente, EntradaHistorial, Tablero, Ticket } from "@/dominio/entidades";
import { parsearContexto, type NuevoTicketInput } from "@/dominio/esquemas";
import { calcularVenceSLA, ZONA_SLA } from "@/dominio/sla";
import { formatTicketId } from "@/dominio/ticket-id";
import type { Pagina, Repositorio } from "@/repositorio/tipos";
import type { ContextoAutorizado } from "./acceso";
import {
  cargarTicketPropio,
  cargarTicketVisible,
  esBhi,
  exigirCliente,
  exigirSoporte,
  filtroPorRol,
  type Vista,
} from "./autorizacion";
import type { Deps } from "./deps";
import { conflicto, ErrorServicio, invalido } from "./errores";

export interface ConsultaTickets {
  vista?: Vista;
  estados?: Estado[];
  q?: string;
  cursor?: string | null;
}

// ─── Lectura ────────────────────────────────────────────────────────────────

export async function listarTickets(
  ctx: ContextoAutorizado,
  { repo }: Pick<Deps, "repo">,
  consulta: ConsultaTickets = {},
): Promise<Pagina<TicketCliente> | Pagina<TicketSoporte>> {
  const filtro = filtroPorRol(ctx, consulta.vista);
  if (consulta.estados?.length) filtro.estados = consulta.estados;
  if (consulta.q?.trim()) filtro.texto = consulta.q.trim().slice(0, 100);

  const pagina = await repo.tickets.listar(filtro, { cursor: consulta.cursor ?? null, limite: 25 });
  const nombres = await cargarNombres(repo, pagina.items);

  if (esBhi(ctx)) return { ...pagina, items: pagina.items.map((t) => aTicketSoporte(t, nombres)) };
  return { ...pagina, items: pagina.items.map((t) => aTicketCliente(t, nombres, ctx.identidad.oid)) };
}

/** Tarjetas de "Mis reclamos": siempre sobre los tickets propios, no cambian con el filtro. */
export async function resumenTickets(ctx: ContextoAutorizado, { repo, ahora }: Pick<Deps, "repo" | "ahora">): Promise<ResumenTickets> {
  exigirCliente(ctx);
  const { items } = await repo.tickets.listar(filtroPorRol(ctx, "mios"), { limite: 5000 });
  const hoy = new TZDate(ahora().getTime(), ZONA_SLA);
  const mesActual = (iso: string) => {
    const d = new TZDate(new Date(iso).getTime(), ZONA_SLA);
    return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
  };
  return {
    abiertos: items.filter((t) => ESTADOS_ABIERTOS.includes(t.estado)).length,
    esperandoRespuesta: items.filter((t) => t.estado === "Esperando al cliente").length,
    resueltosDelMes: items.filter((t) => t.fechaResuelto !== null && mesActual(t.fechaResuelto)).length,
  };
}

export async function obtenerTicketCliente(
  ctx: ContextoAutorizado,
  { repo, ahora }: Pick<Deps, "repo" | "ahora">,
  itemId: number,
): Promise<TicketDetalleCliente> {
  exigirCliente(ctx);
  const t = await cargarTicketVisible(ctx, repo, itemId);
  const nombres = await cargarNombres(repo, [t]);
  const historial = (await repo.historial.listarPorTicket(t.itemId)).filter(esVisibleParaCliente);
  const base = aTicketCliente(t, nombres, ctx.identidad.oid);
  const esAutor = base.esAutor;

  return {
    ...base,
    historial: historial.map((e) => aEntradaCliente(e, t)),
    // Solo los adjuntos de mensajes visibles.
    adjuntos: historial.flatMap((e) => e.adjuntos.map(aAdjuntoDTO)),
    puedeComentar: esAutor && t.estado !== "Cerrado",
    puedeResolver: esAutor && ESTADOS_ABIERTOS.includes(t.estado),
    puedeReabrir: esAutor && dentroDePlazoReapertura(t, ahora()),
  };
}

export async function obtenerTicketSoporte(
  ctx: ContextoAutorizado,
  { repo }: Pick<Deps, "repo">,
  itemId: number,
): Promise<TicketDetalleSoporte> {
  exigirSoporte(ctx);
  const t = await cargarTicketVisible(ctx, repo, itemId);
  const nombres = await cargarNombres(repo, [t]);
  const historial = await repo.historial.listarPorTicket(t.itemId);
  return {
    ...aTicketSoporte(t, nombres),
    historial: historial.map(aEntradaSoporte),
    adjuntos: (await repo.adjuntos.listarPorTicket(t.itemId)).map(aAdjuntoDTO),
    borradoresPendientes: historial.filter((e) => e.tipo === "borrador_respuesta" && e.estadoBorrador === "pendiente").length,
  };
}

/** Tickets no cerrados para el kanban de soporte. */
export async function listarKanban(ctx: ContextoAutorizado, { repo }: Pick<Deps, "repo">): Promise<TicketKanban[]> {
  exigirSoporte(ctx);
  const { items } = await repo.tickets.listar({ estados: ESTADOS_ABIERTOS.concat("Resuelto") }, { limite: 1000 });
  const nombres = await cargarNombres(repo, items);
  const conBorrador = await repo.historial.ticketsConBorradorPendiente();
  return items.map((t) => ({ ...aTicketSoporte(t, nombres), borradorPendiente: conBorrador.has(t.itemId) }));
}

// ─── Escritura (cliente) ────────────────────────────────────────────────────

async function guardarAdjuntos(repo: Repositorio, itemId: number, archivos: readonly ArchivoEntrante[]): Promise<Adjunto[]> {
  const r = validarAdjuntos(archivos);
  if (!r.ok) {
    throw new ErrorServicio(r.error.status, MENSAJE_ERROR_ADJUNTO[r.error.code], r.error.code);
  }
  const guardados: Adjunto[] = [];
  for (const a of r.archivos) {
    const { id, nombre, tipo, tamano } = await repo.adjuntos.guardar(itemId, { nombre: a.nombre, tipo: a.tipo, datos: a.datos });
    guardados.push({ id, nombre, tipo, tamano });
  }
  return guardados;
}

export async function crearTicket(
  ctx: ContextoAutorizado,
  { repo, notificador, ahora }: Deps,
  input: NuevoTicketInput,
  archivos: readonly ArchivoEntrante[] = [],
): Promise<{ ticketId: string; itemId: number }> {
  exigirCliente(ctx);
  // Se valida antes de crear nada para no dejar tickets a medias.
  const previa = validarAdjuntos(archivos);
  if (!previa.ok) throw new ErrorServicio(previa.error.status, MENSAJE_ERROR_ADJUNTO[previa.error.code], previa.error.code);

  const tablero = await repo.tableros.obtener(input.tableroId);
  if (!tablero || !tablero.activo || tablero.clienteId !== ctx.acceso.cliente.id) {
    throw invalido("Elegí un tablero de tu organización.", "tablero_invalido");
  }

  const momento = ahora();
  const fecha = momento.toISOString();
  const prioridad = PRIORIDAD_INICIAL[input.urgencia];
  const feriados = new Set((await repo.feriados.listar()).map((f) => f.fecha));
  const { identidad } = ctx;

  const ticket = await repo.tickets.crear({
    clienteId: ctx.acceso.cliente.id,
    tableroId: tablero.tableroId,
    pagina: input.pagina || null,
    contexto: parsearContexto(input.contexto),
    tipo: input.tipo,
    descripcion: input.descripcion,
    urgencia: input.urgencia,
    estado: "Nuevo",
    prioridad,
    categoria: null,
    resumenIA: null,
    procesadoIA: false,
    autorOid: identidad.oid,
    autorNombre: identidad.nombre,
    autorEmail: identidad.email.toLowerCase(),
    asignadoA: null,
    fechaAlta: fecha,
    ultimaActualizacion: fecha,
    fechaResuelto: null,
    venceSLA: calcularVenceSLA(momento, prioridad, feriados)?.toISOString() ?? null,
  });

  const adjuntos = await guardarAdjuntos(repo, ticket.itemId, archivos);
  await repo.historial.agregar({
    ticketItemId: ticket.itemId,
    tipo: "estado",
    autor: identidad.nombre,
    autorEmail: identidad.email.toLowerCase(),
    autorEsIA: false,
    fecha,
    texto: "Nuevo",
    visible: true,
    estadoBorrador: null,
    adjuntos,
  });
  await notificador.ticketCreado(ticket);
  return { ticketId: formatTicketId(ticket.itemId), itemId: ticket.itemId };
}

/** Comentario visible. Cliente: solo en sus tickets. Soporte: en cualquiera. */
export async function comentar(
  ctx: ContextoAutorizado,
  { repo, ahora }: Deps,
  itemId: number,
  texto: string,
  archivos: readonly ArchivoEntrante[] = [],
): Promise<void> {
  let t: Ticket;
  if (esBhi(ctx)) {
    t = await cargarTicketVisible(ctx, repo, itemId);
  } else {
    exigirCliente(ctx);
    t = await cargarTicketPropio(ctx, repo, itemId);
  }
  if (t.estado === "Cerrado") throw conflicto("El reclamo está cerrado. Si el problema sigue, creá uno nuevo.", "ticket_cerrado");

  const fecha = ahora().toISOString();
  const adjuntos = await guardarAdjuntos(repo, t.itemId, archivos);
  const autor = { autor: ctx.identidad.nombre, autorEmail: ctx.identidad.email.toLowerCase(), autorEsIA: false };
  await repo.historial.agregar({ ticketItemId: t.itemId, tipo: "comentario", ...autor, fecha, texto, visible: true, estadoBorrador: null, adjuntos });

  // Si estábamos esperando al cliente y responde, vuelve a análisis.
  if (!esBhi(ctx) && t.estado === "Esperando al cliente") {
    await repo.historial.agregar({ ticketItemId: t.itemId, tipo: "estado", ...autor, fecha, texto: "En análisis", visible: true, estadoBorrador: null, adjuntos: [] });
    await repo.tickets.actualizar(t.itemId, { estado: "En análisis", ultimaActualizacion: fecha });
  } else {
    await repo.tickets.actualizar(t.itemId, { ultimaActualizacion: fecha });
  }
}

export async function resolverPorCliente(ctx: ContextoAutorizado, { repo, ahora }: Deps, itemId: number): Promise<void> {
  exigirCliente(ctx);
  const t = await cargarTicketPropio(ctx, repo, itemId);
  if (!ESTADOS_ABIERTOS.includes(t.estado)) throw conflicto("El reclamo ya está resuelto o cerrado.", "estado_invalido");
  const fecha = ahora().toISOString();
  await repo.historial.agregar(entradaEstado(ctx, t.itemId, fecha, "Resuelto"));
  await repo.tickets.actualizar(t.itemId, { estado: "Resuelto", fechaResuelto: fecha, ultimaActualizacion: fecha });
}

export async function reabrirPorCliente(ctx: ContextoAutorizado, { repo, ahora }: Deps, itemId: number): Promise<void> {
  exigirCliente(ctx);
  const t = await cargarTicketPropio(ctx, repo, itemId);
  if (t.estado !== "Resuelto") throw conflicto("Solo se puede reabrir un reclamo resuelto.", "estado_invalido");
  if (!dentroDePlazoReapertura(t, ahora())) {
    throw conflicto(`Pasaron más de ${DIAS_PARA_REABRIR} días. Creá un reclamo nuevo.`, "plazo_vencido");
  }
  const fecha = ahora().toISOString();
  await repo.historial.agregar(entradaEstado(ctx, t.itemId, fecha, "En análisis"));
  await repo.tickets.actualizar(t.itemId, { estado: "En análisis", fechaResuelto: null, ultimaActualizacion: fecha });
}

export function dentroDePlazoReapertura(t: Ticket, ahora: Date): boolean {
  if (t.estado !== "Resuelto" || !t.fechaResuelto) return false;
  return ahora.getTime() - new Date(t.fechaResuelto).getTime() <= DIAS_PARA_REABRIR * 24 * 3_600_000;
}

export function entradaEstado(ctx: ContextoAutorizado, ticketItemId: number, fecha: string, estado: Estado) {
  return {
    ticketItemId,
    tipo: "estado" as const,
    autor: ctx.identidad.nombre,
    autorEmail: ctx.identidad.email.toLowerCase(),
    autorEsIA: false,
    fecha,
    texto: estado,
    visible: true,
    estadoBorrador: null,
    adjuntos: [],
  };
}

// ─── Mapeos a DTO ───────────────────────────────────────────────────────────

export function esVisibleParaCliente(e: EntradaHistorial): boolean {
  return e.visible && !TIPOS_HISTORIAL_INTERNOS.includes(e.tipo) && (e.tipo === "estado" || e.tipo === "comentario");
}

interface Nombres {
  clientes: Map<number, Cliente>;
  tableros: Map<string, Tablero>;
}

export async function cargarNombres(repo: Repositorio, tickets: Ticket[]): Promise<Nombres> {
  const clienteIds = [...new Set(tickets.map((t) => t.clienteId))];
  const clientes = new Map<number, Cliente>();
  const tableros = new Map<string, Tablero>();
  for (const id of clienteIds) {
    const c = await repo.clientes.obtener(id);
    if (c) clientes.set(id, c);
    for (const tb of await repo.tableros.listarPorCliente(id)) tableros.set(tb.tableroId, tb);
  }
  return { clientes, tableros };
}

const aAdjuntoDTO = ({ id, nombre, tipo, tamano }: Adjunto): AdjuntoDTO => ({ id, nombre, tipo, tamano });

function aEntradaCliente(e: EntradaHistorial, t: Ticket): EntradaCliente {
  return {
    id: e.id,
    tipo: e.tipo === "estado" ? "estado" : "comentario",
    autor: e.autor,
    // Del lado del cliente solo comenta el autor del ticket; cualquier otro es del equipo de BHI.
    esEquipo: (e.autorEmail ?? "").toLowerCase() !== t.autorEmail.toLowerCase(),
    fecha: e.fecha,
    texto: e.texto,
    adjuntos: e.adjuntos.map(aAdjuntoDTO),
  };
}

function aEntradaSoporte(e: EntradaHistorial): EntradaSoporte {
  return {
    id: e.id,
    tipo: e.tipo,
    autor: e.autor,
    autorEmail: e.autorEmail,
    autorEsIA: e.autorEsIA,
    fecha: e.fecha,
    texto: e.texto,
    visible: e.visible,
    estadoBorrador: e.estadoBorrador,
    adjuntos: e.adjuntos.map(aAdjuntoDTO),
  };
}

export function aTicketCliente(t: Ticket, n: Nombres, oid: string): TicketCliente {
  return {
    ticketId: formatTicketId(t.itemId),
    cliente: n.clientes.get(t.clienteId)?.nombre ?? "",
    tablero: { id: t.tableroId, nombre: n.tableros.get(t.tableroId)?.nombre ?? t.tableroId },
    pagina: t.pagina,
    tipo: t.tipo,
    descripcion: t.descripcion,
    urgencia: t.urgencia,
    estado: t.estado,
    prioridad: t.prioridad,
    autorNombre: t.autorNombre,
    esAutor: t.autorOid === oid,
    fechaAlta: t.fechaAlta,
    ultimaActualizacion: t.ultimaActualizacion,
    fechaResuelto: t.fechaResuelto,
  };
}

export function aTicketSoporte(t: Ticket, n: Nombres): TicketSoporte {
  const { esAutor: _esAutor, ...base } = aTicketCliente(t, n, "");
  return {
    ...base,
    contexto: t.contexto,
    categoria: t.categoria,
    resumenIA: t.resumenIA,
    procesadoIA: t.procesadoIA,
    asignadoA: t.asignadoA,
    autorEmail: t.autorEmail,
    venceSLA: t.venceSLA,
  };
}
