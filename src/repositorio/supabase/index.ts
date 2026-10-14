import type { SupabaseClient } from "@supabase/supabase-js";
import type { Area, Cliente, EntradaHistorial, Tablero, Ticket } from "@/dominio/entidades";
import { parseTicketId } from "@/dominio/ticket-id";
import type { Database } from "@/integrations/supabase/types";
import type { OpcionesPagina, Repositorio } from "../tipos";

type Db = SupabaseClient<Database>;
type Filas = Database["public"]["Tables"];

const LIMITE_POR_DEFECTO = 50;

/** Columnas de `cliente` que el rol `authenticated` puede leer (referentes y notas son internos). */
const COLUMNAS_CLIENTE = "id, nombre, tipo, tenant_id, dominio, activo";

function ok<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data as T;
}

function aCliente(c: Omit<Filas["cliente"]["Row"], "creado_en">): Cliente {
  return {
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    tenantId: c.tenant_id,
    dominio: c.dominio,
    activo: c.activo,
    // Solo los lee el backend (funciones SQL y MCP), nunca el navegador.
    referentesGenerales: [],
    notasContexto: "",
  };
}

function aArea(a: Filas["area"]["Row"]): Area {
  return { id: a.id, clienteId: a.cliente_id, nombre: a.nombre, lideres: a.lideres, activo: a.activo };
}

function aTablero(t: Filas["tablero"]["Row"] & { tablero_area: { area_id: number }[] }): Tablero {
  return {
    tableroId: t.id,
    nombre: t.nombre,
    clienteId: t.cliente_id,
    areaIds: t.tablero_area.map((ta) => ta.area_id),
    paginas: t.paginas,
    activo: t.activo,
  };
}

/** `ticket_soporte` llega `null` para roles de cliente (RLS): los campos internos quedan vacíos. */
function aTicket(t: Filas["ticket"]["Row"] & { ticket_soporte: Filas["ticket_soporte"]["Row"] | null }): Ticket {
  const s = t.ticket_soporte;
  return {
    itemId: t.id,
    clienteId: t.cliente_id,
    tableroId: t.tablero_id,
    pagina: t.pagina,
    contexto: (s?.contexto as Record<string, string> | null) ?? null,
    tipo: t.tipo,
    descripcion: t.descripcion,
    urgencia: t.urgencia,
    estado: t.estado,
    prioridad: t.prioridad,
    categoria: s?.categoria ?? null,
    resumenIA: s?.resumen_ia ?? null,
    procesadoIA: s?.procesado_ia ?? false,
    autorOid: t.autor_id,
    autorNombre: t.autor_nombre,
    autorEmail: s?.autor_email ?? "",
    asignadoA: s?.asignado_a ?? null,
    fechaAlta: t.fecha_alta,
    ultimaActualizacion: t.ultima_actualizacion,
    fechaResuelto: t.fecha_resuelto,
    venceSLA: s?.vence_sla ?? null,
  };
}

/** Valor entre comillas para un filtro `or()` de PostgREST, con `%`/`_` literales para `ilike`. */
function patronIlike(texto: string): string {
  const like = texto.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `"%${like.replace(/[\\"]/g, (c) => `\\${c}`)}%"`;
}

/**
 * Repositorio sobre Supabase. No decide permisos: cada consulta corre con la sesión del
 * usuario y RLS recorta filas (y `ticket_soporte`) según `acceso_actual()`.
 */
export function crearSupabaseRepo(db: Db): Repositorio {
  return {
    clientes: {
      listar: async () => ok(await db.from("cliente").select(COLUMNAS_CLIENTE).order("nombre")).map(aCliente),
      obtener: async (id) => {
        const fila = ok(await db.from("cliente").select(COLUMNAS_CLIENTE).eq("id", id).maybeSingle());
        return fila ? aCliente(fila) : null;
      },
    },
    areas: {
      listarPorCliente: async (clienteId) =>
        ok(await db.from("area").select("*").eq("cliente_id", clienteId).order("id")).map(aArea),
    },
    tableros: {
      listarPorCliente: async (clienteId) =>
        ok(await db.from("tablero").select("*, tablero_area(area_id)").eq("cliente_id", clienteId).order("nombre")).map(aTablero),
      obtener: async (tableroId) => {
        const fila = ok(await db.from("tablero").select("*, tablero_area(area_id)").eq("id", tableroId).maybeSingle());
        return fila ? aTablero(fila) : null;
      },
    },
    tickets: {
      listar: async (filtro, { cursor, limite = LIMITE_POR_DEFECTO }: OpcionesPagina = {}) => {
        // `!inner` solo cuando se filtra por un campo interno (si no, RLS dejaría afuera los tickets de clientes).
        const interno = filtro.asignadoA !== undefined || filtro.procesadoIA !== undefined;
        let q = db.from("ticket").select(interno ? "*, ticket_soporte!inner(*)" : "*, ticket_soporte(*)");

        if (filtro.clienteId !== undefined) q = q.eq("cliente_id", filtro.clienteId);
        if (filtro.alcance) {
          const { autorOid, tableroIds } = filtro.alcance;
          q = tableroIds.length
            ? q.or(`autor_id.eq.${autorOid},tablero_id.in.(${tableroIds.join(",")})`)
            : q.eq("autor_id", autorOid);
        }
        if (filtro.tableroIds) q = q.in("tablero_id", [...filtro.tableroIds]);
        if (filtro.estados?.length) q = q.in("estado", [...filtro.estados]);
        if (filtro.asignadoA !== undefined) q = q.eq("ticket_soporte.asignado_a", filtro.asignadoA);
        if (filtro.procesadoIA !== undefined) q = q.eq("ticket_soporte.procesado_ia", filtro.procesadoIA);
        if (filtro.texto) {
          const id = parseTicketId(filtro.texto);
          const enTexto = `descripcion.ilike.${patronIlike(filtro.texto)}`;
          q = q.or(id === null ? enTexto : `id.eq.${id},${enTexto}`);
        }

        const desde = cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
        // Se pide uno de más para saber si hay otra página.
        const filas = ok(
          await q
            .order("ultima_actualizacion", { ascending: false })
            .order("id", { ascending: false })
            .range(desde, desde + limite),
        );
        return {
          items: filas.slice(0, limite).map(aTicket),
          cursor: filas.length > limite ? String(desde + limite) : null,
        };
      },
      obtener: async (itemId) => {
        const fila = ok(await db.from("ticket").select("*, ticket_soporte(*)").eq("id", itemId).maybeSingle());
        return fila ? aTicket(fila) : null;
      },
    },
    historial: {
      listarPorTicket: async (ticketItemId) =>
        ok(
          await db
            .from("historial")
            .select("*, adjunto(id, nombre, tipo_mime, tamano_bytes)")
            .eq("ticket_id", ticketItemId)
            .order("fecha"),
        ).map(
          (h): EntradaHistorial => ({
            id: h.id,
            ticketItemId: h.ticket_id,
            tipo: h.tipo,
            autor: h.autor,
            autorEmail: h.autor_email,
            autorEsIA: h.autor_es_ia,
            fecha: h.fecha,
            texto: h.texto,
            visible: h.visible,
            estadoBorrador: h.estado_borrador,
            adjuntos: h.adjunto.map((a) => ({ id: a.id, nombre: a.nombre, tipo: a.tipo_mime, tamano: a.tamano_bytes })),
          }),
        ),
    },
    feriados: {
      listar: async () => ok(await db.from("feriado").select("*").order("fecha")),
    },
    solicitudes: {
      listar: async () =>
        ok(await db.from("solicitud_acceso").select("*").order("fecha", { ascending: false })).map((s) => ({
          id: s.id,
          tenantId: s.tenant_id,
          dominio: s.dominio,
          email: s.email,
          nombre: s.nombre,
          fecha: s.fecha,
          estado: s.estado,
        })),
    },
  };
}
