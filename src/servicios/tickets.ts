import type { Estado } from "@/dominio/catalogos";
import type { TicketCliente, TicketSoporte } from "@/dominio/dto";
import type { Cliente, Tablero, Ticket } from "@/dominio/entidades";
import { formatTicketId } from "@/dominio/ticket-id";
import type { Pagina, Repositorio, TicketFiltro } from "@/repositorio/tipos";
import type { Acceso, Identidad } from "./acceso";

/** Contexto ya autenticado y con acceso resuelto (nunca `denegado` ni `elegir_cliente`). */
export type ContextoAutorizado = {
  identidad: Identidad;
  acceso: Extract<Acceso, { tipo: "bhi" } | { tipo: "cliente" }>;
};

/** `mios`, `area:<id>` u `org`. Es una preferencia: se recorta al rol. */
export type Vista = string;

export interface ConsultaTickets {
  vista?: Vista;
  estados?: Estado[];
  q?: string;
  cursor?: string | null;
}

/**
 * Filtro obligatorio según el rol (§5). Toda lectura de tickets pasa por acá.
 * Para roles de cliente siempre incluye `clienteId`.
 */
export function filtroPorRol({ identidad, acceso }: ContextoAutorizado, vista: Vista = "mios"): TicketFiltro {
  if (acceso.tipo === "bhi") return {};

  const base = { clienteId: acceso.cliente.id };
  const propios: TicketFiltro = { ...base, alcance: { autorOid: identidad.oid, tableroIds: [] } };

  switch (acceso.rol) {
    case "usuario":
      return propios;

    case "lider": {
      const area = areaDeVista(vista);
      if (area !== null) {
        const liderada = acceso.areasLideradas.find((a) => a.id === area);
        return liderada ? { ...base, tableroIds: liderada.tableroIds } : propios;
      }
      if (vista === "org") return { ...base, alcance: { autorOid: identidad.oid, tableroIds: acceso.tablerosDeAreas } };
      return propios;
    }

    case "referente":
      if (vista === "org") return base;
      return propios;
  }
}

function areaDeVista(vista: Vista): number | null {
  const m = /^area:(\d+)$/.exec(vista);
  return m?.[1] ? Number(m[1]) : null;
}

export async function listarTickets(
  ctx: ContextoAutorizado,
  repo: Repositorio,
  consulta: ConsultaTickets = {},
): Promise<Pagina<TicketCliente> | Pagina<TicketSoporte>> {
  const filtro = filtroPorRol(ctx, consulta.vista);

  if (consulta.estados?.length) filtro.estados = consulta.estados;
  if (consulta.q?.trim()) filtro.texto = consulta.q.trim();

  const pagina = await repo.tickets.listar(filtro, { cursor: consulta.cursor ?? null });
  const nombres = await cargarNombres(repo, pagina.items);

  if (ctx.acceso.tipo === "bhi") {
    return { ...pagina, items: pagina.items.map((t) => aTicketSoporte(t, nombres)) };
  }
  return { ...pagina, items: pagina.items.map((t) => aTicketCliente(t, nombres, ctx.identidad.oid)) };
}

interface Nombres {
  clientes: Map<number, Cliente>;
  tableros: Map<string, Tablero>;
}

async function cargarNombres(repo: Repositorio, tickets: Ticket[]): Promise<Nombres> {
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
