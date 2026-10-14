import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { formatTicketId } from "@/dominio/ticket-id";
import { CLIENTE, DEMO_BHI_TENANT_ID, PERSONAS_DEMO } from "@/repositorio/demo/datos";
import { resolverAcceso } from "@/servicios/acceso";
import { listarTickets } from "@/servicios/tickets";
import { contextoDe, identidadDe, repoDemo } from "../servicios/helpers";
import { como, crearBaseDemo } from "./entorno";

interface FilaAcceso {
  tipo: string;
  rol: string | null;
  codigo: string | null;
  cliente_id: number | null;
  areas_lideradas: number[] | null;
  clientes: number[] | null;
}

let db: PGlite;

beforeAll(async () => {
  db = await crearBaseDemo();
});

const acceso = (clave: string | null) =>
  como(db, clave, async () => (await db.query<FilaAcceso>("select * from public.acceso_actual()")).rows[0]!);

const ticketsVisibles = (clave: string) =>
  como(db, clave, async () =>
    (await db.query<{ id: number }>("select id from public.ticket order by id")).rows.map((r) => formatTicketId(Number(r.id))),
  );

describe("acceso_actual() replica a resolverAcceso", () => {
  it.each(PERSONAS_DEMO.map((p) => p.clave))("%s", async (clave) => {
    const esperado = await resolverAcceso(identidadDe(clave), repoDemo(), { bhiTenantId: DEMO_BHI_TENANT_ID });
    const fila = await acceso(clave);

    expect(fila.tipo).toBe(esperado.tipo);
    switch (esperado.tipo) {
      case "bhi":
        expect(fila.rol).toBe(esperado.rol);
        break;
      case "cliente":
        expect(fila.rol).toBe(esperado.rol);
        expect(Number(fila.cliente_id)).toBe(esperado.cliente.id);
        expect((fila.areas_lideradas ?? []).map(Number)).toEqual(esperado.areasLideradas.map((a) => a.id));
        break;
      case "elegir_cliente":
        expect((fila.clientes ?? []).map(Number).sort()).toEqual(esperado.clientes.map((c) => c.id).sort());
        break;
      case "denegado":
        expect(fila.codigo).toBe(esperado.code);
        break;
    }
  });

  it("sin sesión (anon) ni siquiera puede llamarla", async () => {
    await expect(acceso(null)).rejects.toThrow(/permission denied for function acceso_actual/);
  });
});

describe("RLS de ticket = techo del rol (§5)", () => {
  it.each(["usuario", "usuario2", "lider", "referente", "litoral", "satelite", "soporte", "admin"])(
    "%s ve lo mismo que su vista más amplia en la demo",
    async (clave) => {
      const repo = repoDemo();
      const { items } = await listarTickets(await contextoDe(clave, repo), repo, { vista: "org" });
      expect(await ticketsVisibles(clave)).toEqual(items.map((t) => t.ticketId).sort());
    },
  );

  it.each(["invitado", "no-habilitado", "satelite-multi"])("%s (sin acceso resuelto) no ve tickets", async (clave) => {
    expect(await ticketsVisibles(clave)).toEqual([]);
  });

  it("anon no lee nada", async () => {
    for (const tabla of ["ticket", "historial", "area", "tablero", "feriado"]) {
      expect((await como(db, null, () => db.query(`select 1 from public.${tabla}`))).rows).toEqual([]);
    }
  });
});

describe("datos internos", () => {
  it("un rol de cliente no lee ticket_soporte", async () => {
    const filas = await como(db, "referente", () => db.query("select * from public.ticket_soporte"));
    expect(filas.rows).toEqual([]);
  });

  it("soporte sí lee ticket_soporte", async () => {
    const filas = await como(db, "soporte", () => db.query("select ticket_id from public.ticket_soporte"));
    expect(filas.rows).toHaveLength(15);
  });

  it("un rol de cliente no ve notas internas, borradores ni entradas ocultas", async () => {
    const filas = await como(db, "usuario", () =>
      db.query<{ tipo: string; visible: boolean }>("select tipo, visible from public.historial where ticket_id = 2"),
    );
    expect(filas.rows.length).toBeGreaterThan(0);
    expect(filas.rows.every((r) => r.visible && r.tipo !== "nota_interna" && r.tipo !== "borrador_respuesta")).toBe(true);
  });

  it("historial de un ticket ajeno no se ve", async () => {
    const filas = await como(db, "litoral", () => db.query("select id from public.historial where ticket_id = 1"));
    expect(filas.rows).toEqual([]);
  });

  it("referentes y notas del cliente no se pueden leer desde el navegador", async () => {
    await expect(como(db, "referente", () => db.query("select notas_contexto from public.cliente"))).rejects.toThrow(/permission denied/);
    const propio = await como(db, "referente", () => db.query<{ id: number }>("select id, nombre from public.cliente"));
    expect(propio.rows.map((r) => Number(r.id))).toEqual([CLIENTE.andina]);
  });

  it("un rol de cliente no puede escribir directo en las tablas", async () => {
    await expect(
      como(db, "usuario", () => db.query("update public.ticket set estado = 'Cerrado' where id = 1 returning id")),
    ).resolves.toMatchObject({ rows: [] });
    await expect(
      como(db, "usuario", () =>
        db.query("insert into public.historial (ticket_id, tipo, autor, texto, visible) values (1, 'comentario', 'x', 'x', true)"),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("funciones del frontend", () => {
  it("satélite en dos clientes: elige uno válido y no puede elegir uno ajeno", async () => {
    expect(await como(db, "satelite-multi", async () => (await db.query("select public.elegir_cliente($1) as ok", [CLIENTE.andina])).rows[0])).toEqual({ ok: false });
    expect(await como(db, "satelite-multi", async () => (await db.query("select public.elegir_cliente($1) as ok", [CLIENTE.patagonia])).rows[0])).toEqual({ ok: true });

    const fila = await acceso("satelite-multi");
    expect(fila).toMatchObject({ tipo: "cliente", rol: "usuario" });
    expect(Number(fila.cliente_id)).toBe(CLIENTE.patagonia);
    expect(await ticketsVisibles("satelite-multi")).toEqual(["TCK-0013"]);

    await como(db, "satelite-multi", () => db.query("select public.olvidar_cliente_elegido()"));
    expect((await acceso("satelite-multi")).tipo).toBe("elegir_cliente");
  });

  it("crear_ticket deriva cliente, autor y prioridad, y queda visible para su autor", async () => {
    const id = await como(db, "litoral", async () => {
      const r = await db.query<{ id: number }>(
        "select public.crear_ticket($1, $2, $3, $4, $5, $6) as id",
        ["acopio-granos", "Dato incorrecto", "El acopio de maíz de hoy no coincide con la balanza.", "Crítica", "pagina-inexistente", { Campo: "Maíz" }],
      );
      return Number(r.rows[0]!.id);
    });

    const fila = await como(db, "soporte", async () =>
      (await db.query<Record<string, unknown>>(
        `select t.cliente_id, t.prioridad, t.estado, t.pagina, t.autor_nombre, s.autor_email, s.contexto
         from public.ticket t join public.ticket_soporte s on s.ticket_id = t.id where t.id = $1`,
        [id],
      )).rows[0],
    );
    expect(fila).toMatchObject({
      prioridad: "P1",
      estado: "Nuevo",
      pagina: null,
      autor_nombre: "Camila Cooperativa",
      autor_email: "camila.coop@litoral.example.com",
      contexto: { Campo: "Maíz" },
    });
    expect(Number(fila!.cliente_id)).toBe(CLIENTE.litoral);
    expect(await ticketsVisibles("litoral")).toContain(formatTicketId(id));
    expect(await ticketsVisibles("usuario")).not.toContain(formatTicketId(id));
  });

  it("crear_ticket rechaza tableros de otro cliente y roles sin acceso", async () => {
    const crear = (clave: string, tablero: string) =>
      como(db, clave, () =>
        db.query("select public.crear_ticket($1, 'Consulta', 'Una consulta con más de veinte caracteres.', 'Baja')", [tablero]),
      );
    await expect(crear("litoral", "ventas-dtc")).rejects.toThrow(/Tablero inexistente/);
    await expect(crear("no-habilitado", "ventas-dtc")).rejects.toThrow(/no puede crear/);
    await expect(crear("soporte", "ventas-dtc")).rejects.toThrow(/no puede crear/);
  });

  it("registrar_solicitud_acceso solo registra tenants no habilitados, una vez", async () => {
    await como(db, "no-habilitado", () => db.query("select public.registrar_solicitud_acceso()"));
    await como(db, "no-habilitado", () => db.query("select public.registrar_solicitud_acceso()"));
    await como(db, "usuario", () => db.query("select public.registrar_solicitud_acceso()"));
    const filas = await como(db, "admin", () => db.query<{ email: string; dominio: string }>("select email, dominio from public.solicitud_acceso"));
    expect(filas.rows).toEqual([{ email: "nadia@otra.example.com", dominio: "otra.example.com" }]);
  });
});
