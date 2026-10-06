import type { Ticket } from "@/dominio/entidades";
import type { Repositorio, TicketFiltro } from "@/repositorio/tipos";
import type { AccesoBhi, AccesoCliente, ContextoAutorizado } from "./acceso";
import { noEncontrado, sinPermiso } from "./errores";

/**
 * Reglas de §5. Toda lectura o escritura de un ticket pasa por acá; la decisión sale
 * solo de la sesión validada (identidad + acceso recalculado), nunca del request.
 */

export type ContextoCliente = ContextoAutorizado & { acceso: AccesoCliente };
export type ContextoBhi = ContextoAutorizado & { acceso: AccesoBhi };

export const esBhi = (ctx: ContextoAutorizado): ctx is ContextoBhi => ctx.acceso.tipo === "bhi";

export function exigirCliente(ctx: ContextoAutorizado): asserts ctx is ContextoCliente {
  if (ctx.acceso.tipo !== "cliente") throw sinPermiso("Esta acción es para usuarios de clientes.");
}

export function exigirSoporte(ctx: ContextoAutorizado): asserts ctx is ContextoBhi {
  if (ctx.acceso.tipo !== "bhi") throw noEncontrado("La página");
}

export function exigirAdmin(ctx: ContextoAutorizado): asserts ctx is ContextoBhi {
  if (ctx.acceso.tipo !== "bhi" || ctx.acceso.rol !== "admin") throw noEncontrado("La página");
}

/** `mios`, `area:<id>` u `org`. Es una preferencia: se recorta al rol. */
export type Vista = string;

function areaDeVista(vista: Vista): number | null {
  const m = /^area:(\d{1,9})$/.exec(vista);
  return m?.[1] ? Number(m[1]) : null;
}

/** Filtro obligatorio según el rol. Para roles de cliente siempre incluye `clienteId`. */
export function filtroPorRol({ identidad, acceso }: ContextoAutorizado, vista: Vista = "mios"): TicketFiltro {
  if (acceso.tipo === "bhi") return {};

  const base = { clienteId: acceso.cliente.id };
  const propios: TicketFiltro = { ...base, alcance: { autorOid: identidad.oid, tableroIds: [] } };

  switch (acceso.rol) {
    case "usuario":
      return propios;

    case "lider": {
      const area = areaDeVista(vista);
      if (area !== null) {
        const liderada = acceso.areasLideradas.find((a) => a.id === area);
        return liderada ? { ...base, tableroIds: liderada.tableroIds } : propios;
      }
      if (vista === "org") return { ...base, alcance: { autorOid: identidad.oid, tableroIds: acceso.tablerosDeAreas } };
      return propios;
    }

    case "referente":
      return vista === "org" ? base : propios;
  }
}

/** Misma regla que `filtroPorRol(ctx, "org")` (el alcance máximo del rol), para un ticket puntual. */
export function puedeLeer({ identidad, acceso }: ContextoAutorizado, t: Ticket): boolean {
  if (acceso.tipo === "bhi") return true;
  if (t.clienteId !== acceso.cliente.id) return false;
  if (t.autorOid === identidad.oid) return true;
  switch (acceso.rol) {
    case "usuario":
      return false;
    case "lider":
      return acceso.tablerosDeAreas.includes(t.tableroId);
    case "referente":
      return true;
  }
}

/** Carga un ticket y aplica la regla de lectura. Fuera de alcance → 404 (no 403). */
export async function cargarTicketVisible(ctx: ContextoAutorizado, repo: Repositorio, itemId: number): Promise<Ticket> {
  const t = await repo.tickets.obtener(itemId);
  if (!t || !puedeLeer(ctx, t)) throw noEncontrado();
  return t;
}

/** Para acciones "solo propios": primero la regla de lectura (404), después autoría (403). */
export async function cargarTicketPropio(ctx: ContextoCliente, repo: Repositorio, itemId: number): Promise<Ticket> {
  const t = await cargarTicketVisible(ctx, repo, itemId);
  if (t.autorOid !== ctx.identidad.oid) throw sinPermiso("Solo quien creó el reclamo puede hacer esto.");
  return t;
}
