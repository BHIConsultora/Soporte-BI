import { formatTicketId } from "@/dominio/ticket-id";
import type { AdjuntoGuardado, Ticket } from "@/dominio/entidades";
import type { OpcionesPagina, Pagina, Repositorio, TicketFiltro } from "../tipos";
import { crearDatosDemo, type DatosDemo } from "./datos";

const LIMITE_POR_DEFECTO = 50;

function coincide(t: Ticket, f: TicketFiltro): boolean {
  if (f.clienteId !== undefined && t.clienteId !== f.clienteId) return false;
  if (f.alcance && t.autorOid !== f.alcance.autorOid && !f.alcance.tableroIds.includes(t.tableroId)) return false;
  if (f.tableroIds && !f.tableroIds.includes(t.tableroId)) return false;
  if (f.estados?.length && !f.estados.includes(t.estado)) return false;
  if (f.prioridades?.length && !f.prioridades.includes(t.prioridad)) return false;
  if (f.asignadoA !== undefined && t.asignadoA !== f.asignadoA) return false;
  if (f.procesadoIA !== undefined && t.procesadoIA !== f.procesadoIA) return false;
  if (f.texto) {
    const q = f.texto.toLocaleLowerCase("es");
    const enTexto = t.descripcion.toLocaleLowerCase("es").includes(q);
    const enId = formatTicketId(t.itemId).toLowerCase().includes(q);
    if (!enTexto && !enId) return false;
  }
  return true;
}

function paginar<T>(items: T[], { cursor, limite = LIMITE_POR_DEFECTO }: OpcionesPagina = {}): Pagina<T> {
  const desde = cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
  const hasta = desde + limite;
  return { items: items.slice(desde, hasta), cursor: hasta < items.length ? String(hasta) : null };
}

const copia = <T>(x: T): T => structuredClone(x);

function noEncontrado(que: string): never {
  throw new Error(`${que} no existe`);
}

/**
 * Repositorio en memoria. Devuelve copias para que nadie mute el estado por referencia.
 * Ojo: en Vercel cada instancia tiene su propia memoria; la demo se reinicia sola.
 */
export function crearDemoRepo(datos: DatosDemo = crearDatosDemo()): Repositorio {
  const archivos = new Map<string, { adjunto: AdjuntoGuardado; datos: Uint8Array }>();
  // Adjuntos que ya vienen en los datos demo: contenido de ejemplo para poder descargarlos.
  for (const e of datos.historial) {
    for (const a of e.adjuntos) {
      archivos.set(a.id, { adjunto: { ...a, ticketItemId: e.ticketItemId }, datos: new TextEncoder().encode("dato,ejemplo\n1,2\n") });
    }
  }
  const siguiente = (lista: { id: number }[]) => Math.max(0, ...lista.map((x) => x.id)) + 1;

  return {
    clientes: {
      listar: async () => copia(datos.clientes),
      obtener: async (id) => copia(datos.clientes.find((c) => c.id === id) ?? null),
      buscarPorTenant: async (tid) =>
        copia(datos.clientes.find((c) => c.tipo === "tenant" && c.tenantId?.toLowerCase() === tid.toLowerCase()) ?? null),
      buscarPorGrupos: async (grupos) =>
        copia(datos.clientes.filter((c) => c.tipo === "satelite" && c.grupoId !== null && grupos.includes(c.grupoId))),
      crear: async (d) => {
        const c = { ...d, id: siguiente(datos.clientes) };
        datos.clientes.push(c);
        return copia(c);
      },
      actualizar: async (id, d) => {
        const i = datos.clientes.findIndex((c) => c.id === id);
        if (i === -1) noEncontrado("Cliente");
        datos.clientes[i] = { ...d, id };
        return copia(datos.clientes[i]!);
      },
    },
    areas: {
      listar: async () => copia(datos.areas),
      listarPorCliente: async (clienteId) => copia(datos.areas.filter((a) => a.clienteId === clienteId)),
      obtener: async (id) => copia(datos.areas.find((a) => a.id === id) ?? null),
      crear: async (d) => {
        const a = { ...d, id: siguiente(datos.areas) };
        datos.areas.push(a);
        return copia(a);
      },
      actualizar: async (id, d) => {
        const i = datos.areas.findIndex((a) => a.id === id);
        if (i === -1) noEncontrado("Área");
        datos.areas[i] = { ...d, id };
        return copia(datos.areas[i]!);
      },
    },
    tableros: {
      listar: async () => copia(datos.tableros),
      listarPorCliente: async (clienteId) => copia(datos.tableros.filter((t) => t.clienteId === clienteId)),
      obtener: async (tableroId) => copia(datos.tableros.find((t) => t.tableroId === tableroId) ?? null),
      crear: async (d) => {
        datos.tableros.push({ ...d });
        return copia(d);
      },
      actualizar: async (tableroId, d) => {
        const i = datos.tableros.findIndex((t) => t.tableroId === tableroId);
        if (i === -1) noEncontrado("Tablero");
        datos.tableros[i] = { ...d, tableroId };
        return copia(datos.tableros[i]!);
      },
    },
    tickets: {
      listar: async (filtro, opciones) => {
        const items = datos.tickets
          .filter((t) => coincide(t, filtro))
          .sort((a, b) => b.ultimaActualizacion.localeCompare(a.ultimaActualizacion) || b.itemId - a.itemId);
        return copia(paginar(items, opciones));
      },
      obtener: async (itemId) => copia(datos.tickets.find((t) => t.itemId === itemId) ?? null),
      crear: async (d) => {
        const t: Ticket = { ...d, itemId: Math.max(0, ...datos.tickets.map((x) => x.itemId)) + 1 };
        datos.tickets.push(t);
        return copia(t);
      },
      actualizar: async (itemId, cambios) => {
        const t = datos.tickets.find((x) => x.itemId === itemId) ?? noEncontrado("Ticket");
        Object.assign(t, cambios);
        return copia(t);
      },
    },
    historial: {
      listarPorTicket: async (id) =>
        copia(datos.historial.filter((h) => h.ticketItemId === id).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)),
      obtener: async (id) => copia(datos.historial.find((h) => h.id === id) ?? null),
      agregar: async (e) => {
        const nueva = { ...e, id: siguiente(datos.historial) };
        datos.historial.push(nueva);
        return copia(nueva);
      },
      actualizar: async (id, cambios) => {
        const e = datos.historial.find((x) => x.id === id) ?? noEncontrado("Entrada");
        Object.assign(e, cambios);
        return copia(e);
      },
      ticketsConBorradorPendiente: async () =>
        new Set(datos.historial.filter((h) => h.tipo === "borrador_respuesta" && h.estadoBorrador === "pendiente").map((h) => h.ticketItemId)),
    },
    adjuntos: {
      guardar: async (ticketItemId, archivo) => {
        const adjunto: AdjuntoGuardado = {
          id: crypto.randomUUID(),
          ticketItemId,
          nombre: archivo.nombre,
          tipo: archivo.tipo,
          tamano: archivo.datos.byteLength,
        };
        archivos.set(adjunto.id, { adjunto, datos: archivo.datos.slice() });
        return copia(adjunto);
      },
      listarPorTicket: async (ticketItemId) =>
        copia([...archivos.values()].filter((a) => a.adjunto.ticketItemId === ticketItemId).map((a) => a.adjunto)),
      obtener: async (id) => {
        const a = archivos.get(id);
        return a ? { adjunto: copia(a.adjunto), datos: a.datos.slice() } : null;
      },
    },
    feriados: {
      listar: async () => copia([...datos.feriados].sort((a, b) => a.fecha.localeCompare(b.fecha))),
      crear: async (d) => {
        const f = { ...d, id: siguiente(datos.feriados) };
        datos.feriados.push(f);
        return copia(f);
      },
      eliminar: async (id) => {
        datos.feriados = datos.feriados.filter((f) => f.id !== id);
      },
    },
    solicitudes: {
      listar: async () => copia([...datos.solicitudes].sort((a, b) => b.fecha.localeCompare(a.fecha))),
      crear: async (d) => {
        const s = { ...d, id: siguiente(datos.solicitudes) };
        datos.solicitudes.push(s);
        return copia(s);
      },
      actualizar: async (id, cambios) => {
        const s = datos.solicitudes.find((x) => x.id === id) ?? noEncontrado("Solicitud");
        Object.assign(s, cambios);
        return copia(s);
      },
    },
  };
}
