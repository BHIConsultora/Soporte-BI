import type {
  Categoria,
  Estado,
  EstadoBorrador,
  EstadoSolicitud,
  Prioridad,
  RolBhi,
  TipoCliente,
  TipoHistorial,
  TipoTicket,
  Urgencia,
} from "./catalogos";

/**
 * Entidades tal como las guarda el repositorio (Supabase o demo).
 * Tablas equivalentes: `supabase/migrations/`.
 * Nunca se serializan directo hacia el navegador: los servicios las mapean a DTOs.
 * Fechas en ISO 8601 (UTC).
 */

export interface Cliente {
  id: number;
  nombre: string;
  tipo: TipoCliente;
  /** Solo clientes `tenant`. Los `satelite` usan cuentas del tenant de BHI (ver `MiembroSatelite`). */
  tenantId: string | null;
  dominio: string | null;
  activo: boolean;
  /** Emails en minúsculas. */
  referentesGenerales: string[];
  notasContexto: string;
}

export interface Area {
  id: number;
  clienteId: number;
  nombre: string;
  /** Emails en minúsculas. */
  lideres: string[];
  activo: boolean;
}

export interface Tablero {
  /** Slug estable, ej. `ventas-dtc`. */
  tableroId: string;
  nombre: string;
  clienteId: number;
  areaIds: number[];
  paginas: string[];
  activo: boolean;
}

export interface Ticket {
  /** ID numérico (`ticket.id`). El ID visible se deriva (`TCK-0042`). */
  itemId: number;
  clienteId: number;
  tableroId: string;
  pagina: string | null;
  /** Filtros que mandó el botón de Power BI (dato no confiable). */
  contexto: Record<string, string> | null;
  tipo: TipoTicket;
  descripcion: string;
  urgencia: Urgencia;
  estado: Estado;
  prioridad: Prioridad;
  categoria: Categoria | null;
  resumenIA: string | null;
  procesadoIA: boolean;
  /** Identificador estable del autor (en Supabase, `auth.users.id`). */
  autorOid: string;
  autorNombre: string;
  autorEmail: string;
  asignadoA: string | null;
  fechaAlta: string;
  ultimaActualizacion: string;
  fechaResuelto: string | null;
  venceSLA: string | null;
}

export interface Adjunto {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
}

export interface EntradaHistorial {
  id: number;
  ticketItemId: number;
  tipo: TipoHistorial;
  autor: string;
  autorEmail: string | null;
  autorEsIA: boolean;
  fecha: string;
  texto: string;
  visible: boolean;
  estadoBorrador: EstadoBorrador | null;
  adjuntos: Adjunto[];
}

export interface SolicitudAcceso {
  id: number;
  tenantId: string;
  dominio: string | null;
  email: string;
  nombre: string;
  fecha: string;
  estado: EstadoSolicitud;
}

export interface Feriado {
  id: number;
  /** `yyyy-MM-dd` en hora de Buenos Aires. */
  fecha: string;
  descripcion: string;
}

/** Personal de BHI con acceso de soporte. Solo cuenta para logins del tenant de BHI. */
export interface PersonalBhi {
  /** En minúsculas. */
  email: string;
  rol: RolBhi;
  activo: boolean;
}

/** Cuenta del tenant de BHI que trabaja para un cliente satélite. */
export interface MiembroSatelite {
  clienteId: number;
  /** En minúsculas. */
  email: string;
}
