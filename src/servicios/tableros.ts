import type { Tablero } from "@/dominio/entidades";
import type { ContextoAutorizado } from "./acceso";
import { exigirCliente } from "./autorizacion";
import type { Deps } from "./deps";

export type TableroDTO = Pick<Tablero, "tableroId" | "nombre" | "paginas">;

/** Tableros activos del cliente de la sesión (para el formulario de alta). */
export async function listarTablerosCliente(ctx: ContextoAutorizado, { repo }: Pick<Deps, "repo">): Promise<TableroDTO[]> {
  exigirCliente(ctx);
  const tableros = await repo.tableros.listarPorCliente(ctx.acceso.cliente.id);
  return tableros
    .filter((t) => t.activo)
    .map(({ tableroId, nombre, paginas }) => ({ tableroId, nombre, paginas }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
