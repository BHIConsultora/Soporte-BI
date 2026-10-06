import type { Categoria, Estado, Prioridad, TipoTicket, Urgencia } from "./catalogos";

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
