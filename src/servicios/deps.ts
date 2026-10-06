import type { Ticket } from "@/dominio/entidades";
import type { Repositorio } from "@/repositorio/tipos";

/** Avisos hacia afuera (correo al cliente, Teams). Se implementa en la etapa 4. */
export interface Notificador {
  ticketCreado(ticket: Ticket): Promise<void>;
  respuestaPublicada(ticket: Ticket, texto: string): Promise<void>;
}

export const notificadorNulo: Notificador = {
  ticketCreado: async () => {},
  respuestaPublicada: async () => {},
};

/** Dependencias de los servicios: inyectables para tests (repo demo, reloj fijo). */
export interface Deps {
  repo: Repositorio;
  notificador: Notificador;
  ahora: () => Date;
}
