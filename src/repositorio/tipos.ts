import type { Estado, Prioridad } from "@/dominio/catalogos";
import type {
  AdjuntoGuardado,
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
  prioridades?: readonly Prioridad[];
  /** Búsqueda libre en descripción (y en el ID visible). */
  texto?: string;
  /** `null` = sin asignar. */
  asignadoA?: string | null;
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

export type NuevoTicket = Omit<Ticket, "itemId">;
export type CambiosTicket = Partial<
  Pick<
    Ticket,
    | "estado"
    | "prioridad"
    | "categoria"
    | "resumenIA"
    | "procesadoIA"
    | "asignadoA"
    | "ultimaActualizacion"
    | "fechaResuelto"
    | "venceSLA"
  >
>;

export type NuevaEntrada = Omit<EntradaHistorial, "id">;
export type CambiosEntrada = Partial<Pick<EntradaHistorial, "texto" | "estadoBorrador" | "visible">>;

export interface ArchivoAGuardar {
  nombre: string;
  tipo: string;
  datos: Uint8Array;
}

export interface Repositorio {
  clientes: {
    listar(): Promise<Cliente[]>;
    obtener(id: number): Promise<Cliente | null>;
    buscarPorTenant(tenantId: string): Promise<Cliente | null>;
    buscarPorGrupos(grupoIds: readonly string[]): Promise<Cliente[]>;
    crear(datos: Omit<Cliente, "id">): Promise<Cliente>;
    actualizar(id: number, datos: Omit<Cliente, "id">): Promise<Cliente>;
  };
  areas: {
    listar(): Promise<Area[]>;
    listarPorCliente(clienteId: number): Promise<Area[]>;
    obtener(id: number): Promise<Area | null>;
    crear(datos: Omit<Area, "id">): Promise<Area>;
    actualizar(id: number, datos: Omit<Area, "id">): Promise<Area>;
  };
  tableros: {
    listar(): Promise<Tablero[]>;
    listarPorCliente(clienteId: number): Promise<Tablero[]>;
    obtener(tableroId: string): Promise<Tablero | null>;
    crear(datos: Tablero): Promise<Tablero>;
    actualizar(tableroId: string, datos: Omit<Tablero, "tableroId">): Promise<Tablero>;
  };
  tickets: {
    listar(filtro: TicketFiltro, opciones?: OpcionesPagina): Promise<Pagina<Ticket>>;
    obtener(itemId: number): Promise<Ticket | null>;
    crear(datos: NuevoTicket): Promise<Ticket>;
    actualizar(itemId: number, cambios: CambiosTicket): Promise<Ticket>;
  };
  historial: {
    listarPorTicket(ticketItemId: number): Promise<EntradaHistorial[]>;
    obtener(id: number): Promise<EntradaHistorial | null>;
    agregar(entrada: NuevaEntrada): Promise<EntradaHistorial>;
    actualizar(id: number, cambios: CambiosEntrada): Promise<EntradaHistorial>;
    /** IDs de tickets con al menos un borrador `pendiente` (una sola consulta). */
    ticketsConBorradorPendiente(): Promise<Set<number>>;
  };
  adjuntos: {
    guardar(ticketItemId: number, archivo: ArchivoAGuardar): Promise<AdjuntoGuardado>;
    listarPorTicket(ticketItemId: number): Promise<AdjuntoGuardado[]>;
    obtener(id: string): Promise<{ adjunto: AdjuntoGuardado; datos: Uint8Array } | null>;
  };
  feriados: {
    listar(): Promise<Feriado[]>;
    crear(datos: Omit<Feriado, "id">): Promise<Feriado>;
    eliminar(id: number): Promise<void>;
  };
  solicitudes: {
    listar(): Promise<SolicitudAcceso[]>;
    crear(datos: Omit<SolicitudAcceso, "id">): Promise<SolicitudAcceso>;
    actualizar(id: number, cambios: Pick<SolicitudAcceso, "estado">): Promise<SolicitudAcceso>;
  };
}
