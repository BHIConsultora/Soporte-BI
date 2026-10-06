import type { Area, Cliente, Feriado, SolicitudAcceso, Tablero } from "@/dominio/entidades";
import type { AreaInput, ClienteInput, TableroInput } from "@/dominio/esquemas";
import type { ContextoAutorizado } from "./acceso";
import { exigirAdmin } from "./autorizacion";
import type { Deps } from "./deps";
import { conflicto, invalido, noEncontrado } from "./errores";

/** Configuración del sistema: solo rol Admin. Cualquier otro → 404. */

export interface DatosAdmin {
  clientes: Cliente[];
  areas: Area[];
  tableros: Tablero[];
  feriados: Feriado[];
  solicitudes: SolicitudAcceso[];
}

type RepoDeps = Pick<Deps, "repo">;

export async function cargarDatosAdmin(ctx: ContextoAutorizado, { repo }: RepoDeps): Promise<DatosAdmin> {
  exigirAdmin(ctx);
  const [clientes, areas, tableros, feriados, solicitudes] = await Promise.all([
    repo.clientes.listar(),
    repo.areas.listar(),
    repo.tableros.listar(),
    repo.feriados.listar(),
    repo.solicitudes.listar(),
  ]);
  return { clientes, areas, tableros, feriados, solicitudes };
}

function normalizarCliente(input: ClienteInput): Omit<Cliente, "id"> {
  return {
    nombre: input.nombre,
    tipo: input.tipo,
    tenantId: input.tipo === "tenant" ? (input.tenantId?.toLowerCase() ?? null) : null,
    grupoId: input.tipo === "satelite" ? (input.grupoId?.toLowerCase() ?? null) : null,
    dominio: input.dominio || null,
    activo: input.activo,
    referentesGenerales: input.referentesGenerales,
    notasContexto: input.notasContexto,
  };
}

async function verificarUnicidad({ repo }: RepoDeps, c: Omit<Cliente, "id">, excluirId?: number) {
  const otros = (await repo.clientes.listar()).filter((x) => x.id !== excluirId);
  if (c.tenantId && otros.some((x) => x.tenantId?.toLowerCase() === c.tenantId)) {
    throw conflicto("Ya hay un cliente con ese TenantId.", "tenant_duplicado");
  }
  if (c.grupoId && otros.some((x) => x.grupoId?.toLowerCase() === c.grupoId)) {
    throw conflicto("Ya hay un cliente con ese grupo.", "grupo_duplicado");
  }
}

export async function crearCliente(ctx: ContextoAutorizado, deps: RepoDeps, input: ClienteInput): Promise<Cliente> {
  exigirAdmin(ctx);
  const datos = normalizarCliente(input);
  await verificarUnicidad(deps, datos);
  return deps.repo.clientes.crear(datos);
}

export async function actualizarCliente(ctx: ContextoAutorizado, deps: RepoDeps, id: number, input: ClienteInput): Promise<Cliente> {
  exigirAdmin(ctx);
  if (!(await deps.repo.clientes.obtener(id))) throw noEncontrado("El cliente");
  const datos = normalizarCliente(input);
  await verificarUnicidad(deps, datos, id);
  return deps.repo.clientes.actualizar(id, datos);
}

export async function crearArea(ctx: ContextoAutorizado, { repo }: RepoDeps, input: AreaInput): Promise<Area> {
  exigirAdmin(ctx);
  if (!(await repo.clientes.obtener(input.clienteId))) throw invalido("El cliente no existe.");
  return repo.areas.crear(input);
}

export async function actualizarArea(ctx: ContextoAutorizado, { repo }: RepoDeps, id: number, input: AreaInput): Promise<Area> {
  exigirAdmin(ctx);
  const actual = await repo.areas.obtener(id);
  if (!actual) throw noEncontrado("El área");
  if (actual.clienteId !== input.clienteId) throw invalido("Un área no se puede mover a otro cliente.");
  return repo.areas.actualizar(id, input);
}

async function validarTablero({ repo }: RepoDeps, input: TableroInput) {
  if (!(await repo.clientes.obtener(input.clienteId))) throw invalido("El cliente no existe.");
  const areasCliente = new Set((await repo.areas.listarPorCliente(input.clienteId)).map((a) => a.id));
  if (input.areaIds.some((id) => !areasCliente.has(id))) throw invalido("Hay áreas que no son de ese cliente.");
}

export async function crearTablero(ctx: ContextoAutorizado, deps: RepoDeps, input: TableroInput): Promise<Tablero> {
  exigirAdmin(ctx);
  if (await deps.repo.tableros.obtener(input.tableroId)) {
    throw conflicto("Ya existe un tablero con ese identificador.", "tablero_duplicado");
  }
  await validarTablero(deps, input);
  return deps.repo.tableros.crear({ ...input, areaIds: [...new Set(input.areaIds)], paginas: [...new Set(input.paginas)] });
}

export async function actualizarTablero(ctx: ContextoAutorizado, deps: RepoDeps, tableroId: string, input: TableroInput): Promise<Tablero> {
  exigirAdmin(ctx);
  const actual = await deps.repo.tableros.obtener(tableroId);
  if (!actual) throw noEncontrado("El tablero");
  // El identificador es estable: lo usan los botones de Power BI ya publicados.
  if (input.tableroId !== tableroId) throw invalido("El identificador del tablero no se puede cambiar.");
  if (actual.clienteId !== input.clienteId) throw invalido("Un tablero no se puede mover a otro cliente.");
  await validarTablero(deps, input);
  const { tableroId: _id, ...resto } = input;
  return deps.repo.tableros.actualizar(tableroId, {
    ...resto,
    areaIds: [...new Set(resto.areaIds)],
    paginas: [...new Set(resto.paginas)],
  });
}

export async function crearFeriado(ctx: ContextoAutorizado, { repo }: RepoDeps, input: Omit<Feriado, "id">): Promise<Feriado> {
  exigirAdmin(ctx);
  if ((await repo.feriados.listar()).some((f) => f.fecha === input.fecha)) {
    throw conflicto("Ese día ya está cargado.", "feriado_duplicado");
  }
  return repo.feriados.crear(input);
}

export async function eliminarFeriado(ctx: ContextoAutorizado, { repo }: RepoDeps, id: number): Promise<void> {
  exigirAdmin(ctx);
  if (!(await repo.feriados.listar()).some((f) => f.id === id)) throw noEncontrado("El feriado");
  await repo.feriados.eliminar(id);
}

/** Aprobar crea el cliente (tipo tenant) si todavía no existe. Rechazar solo marca la solicitud. */
export async function resolverSolicitud(
  ctx: ContextoAutorizado,
  { repo }: RepoDeps,
  id: number,
  estado: "aprobada" | "rechazada",
): Promise<{ clienteId: number | null }> {
  exigirAdmin(ctx);
  const s = (await repo.solicitudes.listar()).find((x) => x.id === id);
  if (!s) throw noEncontrado("La solicitud");
  if (s.estado !== "pendiente") throw conflicto("La solicitud ya fue resuelta.", "solicitud_resuelta");

  let clienteId: number | null = null;
  if (estado === "aprobada") {
    const existente = await repo.clientes.buscarPorTenant(s.tenantId);
    clienteId = existente?.id ?? null;
    if (clienteId === null) {
      const nuevo = await repo.clientes.crear({
        nombre: s.dominio ?? "Cliente nuevo",
        tipo: "tenant",
        tenantId: s.tenantId.toLowerCase(),
        grupoId: null,
        dominio: s.dominio,
        activo: true,
        referentesGenerales: [],
        notasContexto: "",
      });
      clienteId = nuevo.id;
    }
  }
  await repo.solicitudes.actualizar(id, { estado });
  return { clienteId };
}
