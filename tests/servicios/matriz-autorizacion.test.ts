import { describe, expect, it } from "vitest";
import { formatTicketId } from "@/dominio/ticket-id";
import { descargarAdjunto } from "@/servicios/adjuntos";
import { crearCliente } from "@/servicios/admin";
import { puedeLeer } from "@/servicios/autorizacion";
import { agregarNotaInterna, actualizarTicket, descartarBorrador, publicarBorrador, tomarTicket } from "@/servicios/soporte";
import {
  comentar,
  crearTicket,
  obtenerTicketCliente,
  obtenerTicketSoporte,
  reabrirPorCliente,
  resolverPorCliente,
} from "@/servicios/tickets";
import { ARCHIVO_PNG, contextoDe, depsDemo, repoDemo, resultado } from "./helpers";

/**
 * Matriz de autorización (§14): cada rol × cada operación × recurso
 * propio / ajeno del mismo cliente / de otra área / tablero compartido / otro cliente / satélite.
 *
 * Tickets demo de referencia:
 *  1  Andina · ventas-dtc (Comercial)            · autor: usuario
 *  3  Andina · margen-por-canal (Comercial+Fin.) · autor: usuario2   ← tablero compartido
 *  4  Andina · cobranzas (Finanzas)              · autor: usuario2   ← otra área
 *  6  Andina · ventas-dtc (cerrado)              · autor: líder
 *  9  Litoral                                    · autor: litoral    ← otro cliente
 * 12  Patagonia (satélite)                       · autor: satélite
 * 15  Andina · stock (Logística)                 · autor: referente
 */
const TICKETS = [1, 3, 4, 6, 9, 12, 15] as const;
type R = "ok" | 403 | 404 | 409;

const LECTURA: Record<string, Record<(typeof TICKETS)[number], R>> = {
  usuario: { 1: "ok", 3: 404, 4: 404, 6: 404, 9: 404, 12: 404, 15: 404 },
  usuario2: { 1: 404, 3: "ok", 4: "ok", 6: 404, 9: 404, 12: 404, 15: 404 },
  lider: { 1: "ok", 3: "ok", 4: 404, 6: "ok", 9: 404, 12: 404, 15: 404 },
  referente: { 1: "ok", 3: "ok", 4: "ok", 6: "ok", 9: 404, 12: 404, 15: "ok" },
  litoral: { 1: 404, 3: 404, 4: 404, 6: 404, 9: "ok", 12: 404, 15: 404 },
  satelite: { 1: 404, 3: 404, 4: 404, 6: 404, 9: 404, 12: "ok", 15: 404 },
};

const AUTORES: Record<(typeof TICKETS)[number], string> = { 1: "usuario", 3: "usuario2", 4: "usuario2", 6: "lider", 9: "litoral", 12: "satelite", 15: "referente" };

describe("matriz de autorización · roles de cliente", () => {
  for (const [rol, esperado] of Object.entries(LECTURA)) {
    for (const id of TICKETS) {
      const lectura = esperado[id];
      // Escribir: fuera de alcance 404; en alcance pero ajeno 403; propio ok (TCK-0006 está cerrado: 409).
      const escritura: R = lectura !== "ok" ? 404 : AUTORES[id] !== rol ? 403 : id === 6 ? 409 : "ok";

      it(`${rol} · ${formatTicketId(id)} → leer ${lectura}, comentar ${escritura}`, async () => {
        const repo = repoDemo();
        const deps = depsDemo(repo);
        const ctx = await contextoDe(rol, repo);

        expect(await resultado(() => obtenerTicketCliente(ctx, deps, id))).toBe(lectura);
        expect(puedeLeer(ctx, (await repo.tickets.obtener(id))!)).toBe(lectura === "ok");
        expect(await resultado(() => comentar(ctx, deps, id, "Hola, ¿novedades?"))).toBe(escritura);
        // Operaciones de soporte: para un cliente "no existen" → 404.
        expect(await resultado(() => obtenerTicketSoporte(ctx, deps, id))).toBe(404);
        expect(await resultado(() => actualizarTicket(ctx, deps, id, { estado: "Cerrado" }))).toBe(404);
        expect(await resultado(() => tomarTicket(ctx, deps, id))).toBe(404);
        expect(await resultado(() => agregarNotaInterna(ctx, deps, id, "x"))).toBe(404);
      });
    }
  }

  it("resolver y reabrir: solo el autor", async () => {
    const repo = repoDemo();
    const deps = depsDemo(repo);
    // TCK-1 es de usuario; el referente lo ve pero no puede resolverlo.
    expect(await resultado(async () => resolverPorCliente(await contextoDe("referente", repo), deps, 1))).toBe(403);
    expect(await resultado(async () => resolverPorCliente(await contextoDe("litoral", repo), deps, 1))).toBe(404);
    expect(await resultado(async () => resolverPorCliente(await contextoDe("usuario", repo), deps, 1))).toBe("ok");
    expect(await resultado(async () => reabrirPorCliente(await contextoDe("lider", repo), deps, 1))).toBe(403);
    expect(await resultado(async () => reabrirPorCliente(await contextoDe("usuario", repo), deps, 1))).toBe("ok");
  });

  it("borradores: un cliente no puede publicarlos ni descartarlos", async () => {
    const repo = repoDemo();
    const deps = depsDemo(repo);
    const borrador = (await repo.historial.listarPorTicket(2)).find((e) => e.tipo === "borrador_respuesta")!;
    const ctx = await contextoDe("usuario", repo); // autor de TCK-2
    expect(await resultado(() => publicarBorrador(ctx, deps, 2, borrador.id, "hackeado"))).toBe(404);
    expect(await resultado(() => descartarBorrador(ctx, deps, 2, borrador.id))).toBe(404);
  });

  it("admin: ningún cliente ni soporte puede administrar", async () => {
    const repo = repoDemo();
    const input = {
      nombre: "X",
      tipo: "tenant" as const,
      tenantId: "11111111-1111-4111-8111-111111111111",
      activo: true,
      referentesGenerales: [],
      notasContexto: "",
    };
    for (const rol of ["usuario", "lider", "referente", "satelite", "soporte"]) {
      expect(await resultado(async () => crearCliente(await contextoDe(rol, repo), { repo }, input))).toBe(404);
    }
    expect(await resultado(async () => crearCliente(await contextoDe("admin", repo), { repo }, input))).toBe("ok");
  });
});

describe("matriz de autorización · soporte y admin", () => {
  for (const rol of ["soporte", "admin"]) {
    it(`${rol} lee y gestiona cualquier ticket`, async () => {
      const repo = repoDemo();
      const deps = depsDemo(repo);
      const ctx = await contextoDe(rol, repo);
      for (const id of TICKETS) {
        expect(await resultado(() => obtenerTicketSoporte(ctx, deps, id))).toBe("ok");
        expect(await resultado(() => agregarNotaInterna(ctx, deps, id, "Revisar"))).toBe("ok");
      }
      expect(await resultado(() => comentar(ctx, deps, 9, "Hola desde soporte"))).toBe("ok");
      expect(await resultado(() => tomarTicket(ctx, deps, 12))).toBe("ok");
      // Las acciones "del autor" son solo de clientes.
      expect(await resultado(() => resolverPorCliente(ctx, deps, 1))).toBe(403);
      expect(await resultado(() => obtenerTicketCliente(ctx, deps, 1))).toBe(403);
      // Inexistente → 404.
      expect(await resultado(() => obtenerTicketSoporte(ctx, deps, 9999))).toBe(404);
    });
  }

  it("soporte no puede crear tickets (son de clientes)", async () => {
    const repo = repoDemo();
    const ctx = await contextoDe("soporte", repo);
    const input = { tableroId: "ventas-dtc", tipo: "Consulta" as const, descripcion: "x".repeat(30), urgencia: "Baja" as const };
    expect(await resultado(() => crearTicket(ctx, depsDemo(repo), input))).toBe(403);
  });
});

describe("datos internos nunca llegan a un cliente", () => {
  it("ninguna entrada interna aparece en el DTO de cliente, para ningún rol ni ticket visible", async () => {
    const repo = repoDemo();
    const deps = depsDemo(repo);
    const soporte = await contextoDe("soporte", repo);
    for (const id of [1, 2, 3, 7, 9, 13]) await agregarNotaInterna(soporte, deps, id, "SECRETO-INTERNO");

    for (const rol of Object.keys(LECTURA)) {
      const ctx = await contextoDe(rol, repo);
      for (let id = 1; id <= 15; id++) {
        const r = await obtenerTicketCliente(ctx, deps, id).catch(() => null);
        if (!r) continue;
        const json = JSON.stringify(r);
        expect(json).not.toContain("SECRETO-INTERNO");
        expect(json).not.toContain("Claude");
        for (const campo of ["categoria", "resumenIA", "procesadoIA", "asignadoA", "contexto", "venceSLA"]) expect(r).not.toHaveProperty(campo);
        expect(r.historial.every((e) => e.tipo === "estado" || e.tipo === "comentario")).toBe(true);
      }
    }
  });

  it("un adjunto de un ticket ajeno o de otra organización no se puede bajar", async () => {
    const repo = repoDemo();
    const deps = depsDemo(repo);
    const { itemId } = await crearTicket(
      await contextoDe("litoral", repo),
      deps,
      { tableroId: "acopio-granos", tipo: "Consulta", descripcion: "Adjunto una captura del problema.", urgencia: "Baja" },
      [ARCHIVO_PNG],
    );
    const [adj] = await repo.adjuntos.listarPorTicket(itemId);
    expect(await resultado(async () => descargarAdjunto(await contextoDe("litoral", repo), deps, adj!.id))).toBe("ok");
    expect(await resultado(async () => descargarAdjunto(await contextoDe("soporte", repo), deps, adj!.id))).toBe("ok");
    expect(await resultado(async () => descargarAdjunto(await contextoDe("referente", repo), deps, adj!.id))).toBe(404);
    expect(await resultado(async () => descargarAdjunto(await contextoDe("usuario", repo), deps, "00000000-0000-4000-8000-000000000000"))).toBe(404);
  });

  it("el adjunto demo de TCK-0001 lo bajan el autor, el líder y el referente, no otro usuario", async () => {
    const repo = repoDemo();
    const deps = depsDemo(repo);
    const id = "00000000-0000-4000-a000-000000000001";
    for (const rol of ["usuario", "lider", "referente", "soporte"]) {
      expect(await resultado(async () => descargarAdjunto(await contextoDe(rol, repo), deps, id))).toBe("ok");
    }
    expect(await resultado(async () => descargarAdjunto(await contextoDe("usuario2", repo), deps, id))).toBe(404);
  });
});
