export type Rol = "usuario" | "referente" | "soporte";
export type Estado = "Nuevo" | "En análisis" | "Esperando al cliente" | "Resuelto" | "Cerrado";
export type Prioridad = "P1" | "P2" | "P3" | "P4";
export type Urgencia = "Baja" | "Media" | "Alta" | "Crítica";

export const ESTADOS: Estado[] = ["Nuevo", "En análisis", "Esperando al cliente", "Resuelto", "Cerrado"];
export const PRIORIDADES: Prioridad[] = ["P1", "P2", "P3", "P4"];
export const URGENCIAS: Urgencia[] = ["Baja", "Media", "Alta", "Crítica"];
export const TIPOS = [
  "Dato incorrecto",
  "El tablero no se actualiza",
  "Acceso / permisos",
  "Error visual o de carga",
  "Pedido de mejora",
  "Consulta",
  "Otro",
] as const;

export interface Me {
  nombre: string;
  email: string;
  cliente: string;
  rol: Rol;
}

export interface Adjunto {
  nombre: string;
  base64?: string | undefined;
  url?: string | undefined;
}

export interface Ticket {
  ticketId: string;
  cliente: string;
  tablero: string;
  pagina?: string;
  tipo: string;
  descripcion: string;
  urgencia: Urgencia;
  estado: Estado;
  prioridad: Prioridad;
  categoria?: string;
  resumenIA?: string;
  procesadoIA?: boolean;
  borradoresPendientes?: number;
  autorNombre: string;
  autorEmail: string;
  fechaAlta: string;
  ultimaActualizacion: string;
  adjuntos?: Adjunto[];
}

export type TipoHistorial = "estado" | "comentario" | "nota_interna" | "borrador_respuesta";

export interface EntradaHistorial {
  id: string;
  tipo: TipoHistorial;
  autor: string;
  fecha: string;
  texto: string;
  adjuntos?: Adjunto[];
}

export interface TicketDetalle extends Ticket {
  historial: EntradaHistorial[];
}

export interface NuevoTicket {
  tablero: string;
  pagina: string;
  tipo: string;
  descripcion: string;
  urgencia: Urgencia;
  adjuntos: { nombre: string; base64: string }[];
}

export type Scope = "mine" | "org" | "all";
