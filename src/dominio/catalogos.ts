/** Valores de dominio compartidos por cliente, servidor, SharePoint y MCP. */

export const TIPOS_TICKET = [
  "Dato incorrecto",
  "El tablero no se actualiza",
  "Acceso / permisos",
  "Error visual o de carga",
  "Pedido de mejora",
  "Consulta",
  "Otro",
] as const;
export type TipoTicket = (typeof TIPOS_TICKET)[number];

/** La categoría la asigna Claude o soporte; usa los mismos valores que el tipo. */
export const CATEGORIAS = TIPOS_TICKET;
export type Categoria = TipoTicket;

export const URGENCIAS = ["Baja", "Media", "Alta", "Crítica"] as const;
export type Urgencia = (typeof URGENCIAS)[number];

export const ESTADOS = ["Nuevo", "En análisis", "Esperando al cliente", "Resuelto", "Cerrado"] as const;
export type Estado = (typeof ESTADOS)[number];

/** Estados que se consideran "abiertos" para los resúmenes. */
export const ESTADOS_ABIERTOS: readonly Estado[] = ["Nuevo", "En análisis", "Esperando al cliente"];

export const PRIORIDADES = ["P1", "P2", "P3", "P4"] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const PRIORIDAD_DESCRIPCION: Record<Prioridad, string> = {
  P1: "Mismo día hábil",
  P2: "24 h hábiles",
  P3: "72 h hábiles",
  P4: "Próxima planificación",
};

export const PRIORIDAD_INICIAL: Record<Urgencia, Prioridad> = {
  Crítica: "P1",
  Alta: "P2",
  Media: "P3",
  Baja: "P4",
};

export const TIPOS_HISTORIAL = [
  "estado",
  "comentario",
  "nota_interna",
  "borrador_respuesta",
  "asignacion",
  "prioridad",
] as const;
export type TipoHistorial = (typeof TIPOS_HISTORIAL)[number];

/** Tipos de historial que nunca ve un rol de cliente. */
export const TIPOS_HISTORIAL_INTERNOS: readonly TipoHistorial[] = ["nota_interna", "borrador_respuesta"];

export const ESTADOS_BORRADOR = ["pendiente", "publicado", "descartado"] as const;
export type EstadoBorrador = (typeof ESTADOS_BORRADOR)[number];

export const TIPOS_CLIENTE = ["tenant", "satelite"] as const;
export type TipoCliente = (typeof TIPOS_CLIENTE)[number];

export const ESTADOS_SOLICITUD = ["pendiente", "aprobada", "rechazada"] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ROLES_CLIENTE = ["usuario", "lider", "referente"] as const;
export type RolCliente = (typeof ROLES_CLIENTE)[number];

export const ROLES_BHI = ["soporte", "admin"] as const;
export type RolBhi = (typeof ROLES_BHI)[number];

export type Rol = RolCliente | RolBhi;

/** Días desde `FechaResuelto` durante los que el autor puede reabrir. */
export const DIAS_PARA_REABRIR = 15;
