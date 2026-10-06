import type { Estado } from "@/dominio/catalogos";
import type {
  Area,
  Cliente,
  EntradaHistorial,
  Feriado,
  SolicitudAcceso,
  Tablero,
  Ticket,
} from "@/dominio/entidades";

/**
 * Persistencia sin autorización: la capa `servicios/` decide qué filtro aplicar.
 * Implementaciones: `sharepoint/` (Graph) y `demo/` (en memoria).
 */

export interface TicketFiltro {
  clienteId?: number;
  /** Alcance de usuario/líder: `AutorOid = autorOid OR TableroId ∈ tableroIds`. */
  alcance?: { autorOid: string; tableroIds: readonly string[] };
  /** `TableroId ∈ tableroIds` (vista de un área). */
  tableroIds?: readonly string[];
  estados?: readonly Estado[];
  /** Búsqueda libre en descripción (y en el ID visible). */
  texto?: string;
  asignadoA?: string;
  procesadoIA?: boolean;
}

export interface Pagina<T> {
  items: T[];
  /** Opaco; `null` si no hay más. */
  cursor: string | null;
}

export interface OpcionesPagina {
  cursor?: string | null;
  limite?: number;
}

export interface Repositorio {
  clientes: {
    listar(): Promise<Cliente[]>;
    obtener(id: number): Promise<Cliente | null>;
    buscarPorTenant(tenantId: string): Promise<Cliente | null>;
    buscarPorGrupos(grupoIds: readonly string[]): Promise<Cliente[]>;
  };
  areas: {
    listarPorCliente(clienteId: number): Promise<Area[]>;
  };
  tableros: {
    listarPorCliente(clienteId: number): Promise<Tablero[]>;
    obtener(tableroId: string): Promise<Tablero | null>;
  };
  tickets: {
    listar(filtro: TicketFiltro, opciones?: OpcionesPagina): Promise<Pagina<Ticket>>;
    obtener(itemId: number): Promise<Ticket | null>;
  };
  historial: {
    listarPorTicket(ticketItemId: number): Promise<EntradaHistorial[]>;
  };
  feriados: {
    listar(): Promise<Feriado[]>;
  };
  solicitudes: {
    listar(): Promise<SolicitudAcceso[]>;
  };
}
