import { formatTicketId } from "@/dominio/ticket-id";
import type { Ticket } from "@/dominio/entidades";
import type { OpcionesPagina, Pagina, Repositorio, TicketFiltro } from "../tipos";
import { crearDatosDemo, type DatosDemo } from "./datos";

const LIMITE_POR_DEFECTO = 50;

function coincide(t: Ticket, f: TicketFiltro): boolean {
  if (f.clienteId !== undefined && t.clienteId !== f.clienteId) return false;
  if (f.alcance && t.autorOid !== f.alcance.autorOid && !f.alcance.tableroIds.includes(t.tableroId)) return false;
  if (f.tableroIds && !f.tableroIds.includes(t.tableroId)) return false;
  if (f.estados?.length && !f.estados.includes(t.estado)) return false;
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

/** Repositorio en memoria. Devuelve copias para que nadie mute el estado por referencia. */
export function crearDemoRepo(datos: DatosDemo = crearDatosDemo()): Repositorio {
  return {
    clientes: {
      listar: async () => copia(datos.clientes),
      obtener: async (id) => copia(datos.clientes.find((c) => c.id === id) ?? null),
      buscarPorTenant: async (tid) =>
        copia(datos.clientes.find((c) => c.tipo === "tenant" && c.tenantId === tid) ?? null),
      buscarPorGrupos: async (grupos) =>
        copia(datos.clientes.filter((c) => c.tipo === "satelite" && c.grupoId !== null && grupos.includes(c.grupoId))),
    },
    areas: {
      listarPorCliente: async (clienteId) => copia(datos.areas.filter((a) => a.clienteId === clienteId)),
    },
    tableros: {
      listarPorCliente: async (clienteId) => copia(datos.tableros.filter((t) => t.clienteId === clienteId)),
      obtener: async (tableroId) => copia(datos.tableros.find((t) => t.tableroId === tableroId) ?? null),
    },
    tickets: {
      listar: async (filtro, opciones) => {
        const items = datos.tickets
          .filter((t) => coincide(t, filtro))
          .sort((a, b) => b.ultimaActualizacion.localeCompare(a.ultimaActualizacion) || b.itemId - a.itemId);
        return copia(paginar(items, opciones));
      },
      obtener: async (itemId) => copia(datos.tickets.find((t) => t.itemId === itemId) ?? null),
    },
    historial: {
      listarPorTicket: async (id) =>
        copia(datos.historial.filter((h) => h.ticketItemId === id).sort((a, b) => a.fecha.localeCompare(b.fecha))),
    },
    feriados: { listar: async () => copia(datos.feriados) },
    solicitudes: { listar: async () => copia(datos.solicitudes) },
  };
}
