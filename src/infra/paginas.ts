import "server-only";
import { notFound } from "next/navigation";
import { parseTicketId } from "@/dominio/ticket-id";
import { ErrorServicio } from "@/servicios/errores";

/** En pantallas, un recurso fuera de alcance se ve igual que uno inexistente: la 404 amigable. */
export async function o404<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ErrorServicio && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }
}

export function ticketIdDePagina(valor: string): number {
  const id = parseTicketId(decodeURIComponent(valor));
  if (id === null) notFound();
  return id;
}
