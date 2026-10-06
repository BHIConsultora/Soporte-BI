import type { Categoria, Estado, EstadoBorrador, Prioridad, TipoHistorial, TipoTicket, Urgencia } from "./catalogos";

/**
 * Lo que sale hacia el navegador. Hay dos tipos distintos a propósito: los campos internos
 * (`categoria`, `resumenIA`, `procesadoIA`, `asignadoA`) solo existen en `TicketSoporte`,
 * así que olvidarse de filtrar para un rol de cliente es un error de compilación.
 */
export interface TicketCliente {
  ticketId: string;
  cliente: string;
  tablero: { id: string; nombre: string };
  pagina: string | null;
  tipo: TipoTicket;
  descripcion: string;
  urgencia: Urgencia;
  estado: Estado;
  prioridad: Prioridad;
  autorNombre: string;
  /** Si quien mira es el autor (habilita comentar, resolver y reabrir). */
  esAutor: boolean;
  fechaAlta: string;
  ultimaActualizacion: string;
  fechaResuelto: string | null;
}

export interface TicketSoporte extends Omit<TicketCliente, "esAutor"> {
  contexto: Record<string, string> | null;
  categoria: Categoria | null;
  resumenIA: string | null;
  procesadoIA: boolean;
  asignadoA: string | null;
  autorEmail: string;
  venceSLA: string | null;
}

export interface AdjuntoDTO {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
}

/** Entrada de la línea de tiempo que ve un cliente: solo estados y comentarios visibles. */
export interface EntradaCliente {
  id: number;
  tipo: "estado" | "comentario";
  autor: string;
  /** El autor es del equipo de BHI (para alinear la burbuja del chat). */
  esEquipo: boolean;
  fecha: string;
  texto: string;
  adjuntos: AdjuntoDTO[];
}

export interface EntradaSoporte {
  id: number;
  tipo: TipoHistorial;
  autor: string;
  autorEmail: string | null;
  autorEsIA: boolean;
  fecha: string;
  texto: string;
  visible: boolean;
  estadoBorrador: EstadoBorrador | null;
  adjuntos: AdjuntoDTO[];
}

export interface TicketDetalleCliente extends TicketCliente {
  historial: EntradaCliente[];
  adjuntos: AdjuntoDTO[];
  puedeComentar: boolean;
  puedeResolver: boolean;
  puedeReabrir: boolean;
}

export interface TicketDetalleSoporte extends TicketSoporte {
  historial: EntradaSoporte[];
  adjuntos: AdjuntoDTO[];
  borradoresPendientes: number;
}

export interface TicketKanban extends TicketSoporte {
  borradorPendiente: boolean;
}

export interface ResumenTickets {
  abiertos: number;
  esperandoRespuesta: number;
  resueltosDelMes: number;
}
