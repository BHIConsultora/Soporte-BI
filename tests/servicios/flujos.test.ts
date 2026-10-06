import { describe, expect, it, vi } from "vitest";
import type { Ticket } from "@/dominio/entidades";
import { resolverSolicitud, crearTablero, actualizarTablero } from "@/servicios/admin";
import { registrarSolicitudSiCorresponde, resolverAcceso } from "@/servicios/acceso";
import { actualizarTicket, descartarBorrador, publicarBorrador, tomarTicket } from "@/servicios/soporte";
import { comentar, crearTicket, obtenerTicketCliente, obtenerTicketSoporte, reabrirPorCliente, resolverPorCliente } from "@/servicios/tickets";
import { DEMO_BHI_TENANT_ID } from "@/repositorio/demo/datos";
import { AHORA, ARCHIVO_PNG, contextoDe, depsDemo, identidadDe, repoDemo, resultado } from "./helpers";

describe("alta de ticket", () => {
  it("crea con prioridad inicial, SLA, historial y adjuntos; avisa al notificador", async () => {
    const repo = repoDemo();
    const ticketCreado = vi.fn(async (_t: Ticket) => {});
    const deps = depsDemo(repo, { ticketCreado, respuestaPublicada: async () => {} });
    const ctx = await contextoDe("usuario", repo);
    const r = await crearTicket(
      ctx,
      deps,
      {
        tableroId: "ventas-dtc",
        pagina: "resumen",
        tipo: "Dato incorrecto",
        descripcion: "Las ventas del mes no coinciden con el ERP.",
        urgencia: "Crítica",
        contexto: JSON.stringify({ Zona: "NOA" }),
      },
      [ARCHIVO_PNG],
    );
    expect(r.ticketId).toBe("TCK-0016");
    const t = (await repo.tickets.obtener(r.itemId))!;
    expect(t).toMatchObject({ estado: "Nuevo", prioridad: "P1", clienteId: 2, autorOid: ctx.identidad.oid, contexto: { Zona: "NOA" } });
    // P1 un martes a las 12 → vence a las 18 del mismo día (21:00 UTC).
    expect(t.venceSLA).toBe("2026-10-06T21:00:00.000Z");
    const [alta] = await repo.historial.listarPorTicket(r.itemId);
    expect(alta).toMatchObject({ tipo: "estado", texto: "Nuevo", visible: true });
    expect(alta!.adjuntos).toHaveLength(1);
    expect(ticketCreado).toHaveBeenCalledOnce();
  });

  it("ignora un tablero de otro cliente (422) y no crea nada", async () => {
    const repo = repoDemo();
    const ctx = await contextoDe("usuario", repo);
    const input = { tableroId: "acopio-granos", tipo: "Consulta" as const, descripcion: "x".repeat(30), urgencia: "Baja" as const };
    expect(await resultado(() => crearTicket(ctx, depsDemo(repo), input))).toBe(422);
    expect((await repo.tickets.listar({})).items).toHaveLength(15);
  });

  it("rechaza adjuntos inválidos antes de crear el ticket", async () => {
    const repo = repoDemo();
    const ctx = await contextoDe("usuario", repo);
    const input = { tableroId: "ventas-dtc", tipo: "Consulta" as const, descripcion: "x".repeat(30), urgencia: "Baja" as const };
    const svg = { nombre: "x.svg", datos: new TextEncoder().encode("<svg onload=alert(1)>") };
    expect(await resultado(() => crearTicket(ctx, depsDemo(repo), input, [svg]))).toBe(422);
    expect((await repo.tickets.listar({})).items).toHaveLength(15);
  });

  it("descarta un contexto inválido", async () => {
    const repo = repoDemo();
    const ctx = await contextoDe("usuario", repo);
    const { itemId } = await crearTicket(ctx, depsDemo(repo), {
      tableroId: "ventas-dtc",
      tipo: "Consulta",
      descripcion: "x".repeat(30),
      urgencia: "Baja",
      contexto: "[1,2,3]",
    });
    expect((await repo.tickets.obtener(itemId))!.contexto).toBeNull();
  });
});

describe("ciclo de vida", () => {
  it("si el cliente responde mientras se lo espera, vuelve a En análisis", async () => {
    const repo = repoDemo();
    await comentar(await contextoDe("usuario2", repo), depsDemo(repo), 3, "Sí, me sirve la nota.");
    expect((await repo.tickets.obtener(3))!.estado).toBe("En análisis");
  });

  it("no se puede comentar un ticket cerrado (409)", async () => {
    const repo = repoDemo();
    expect(await resultado(async () => comentar(await contextoDe("lider", repo), depsDemo(repo), 6, "¿Hay novedades?"))).toBe(409);
  });

  it("reabrir: solo Resuelto y dentro de 15 días", async () => {
    const repo = repoDemo();
    const ref = await contextoDe("referente", repo);
    // TCK-5 resuelto hace 3 días.
    expect((await obtenerTicketCliente(ref, depsDemo(repo), 5)).puedeReabrir).toBe(true);
    const tarde = depsDemo(repo, undefined, new Date(AHORA.getTime() + 13 * 86_400_000));
    expect(await resultado(() => reabrirPorCliente(ref, tarde, 5))).toBe(409);
    expect(await resultado(() => reabrirPorCliente(ref, depsDemo(repo), 5))).toBe("ok");
    expect((await repo.tickets.obtener(5))).toMatchObject({ estado: "En análisis", fechaResuelto: null });
    // TCK-8 de usuario: resuelto hace 20 días → vencido.
    expect(await resultado(async () => reabrirPorCliente(await contextoDe("usuario", repo), depsDemo(repo), 8))).toBe(409);
  });

  it("resolver dos veces da 409", async () => {
    const repo = repoDemo();
    const ctx = await contextoDe("usuario", repo);
    await resolverPorCliente(ctx, depsDemo(repo), 1);
    expect(await resultado(() => resolverPorCliente(ctx, depsDemo(repo), 1))).toBe(409);
  });
});

describe("acciones de soporte", () => {
  it("cambiar prioridad recalcula el SLA y deja historial interno", async () => {
    const repo = repoDemo();
    const ctx = await contextoDe("soporte", repo);
    const antes = (await repo.tickets.obtener(4))!;
    await actualizarTicket(ctx, depsDemo(repo), 4, { prioridad: "P1" });
    const despues = (await repo.tickets.obtener(4))!;
    expect(despues.prioridad).toBe("P1");
    expect(despues.venceSLA).not.toBe(antes.venceSLA);
    const ultima = (await repo.historial.listarPorTicket(4)).at(-1)!;
    expect(ultima).toMatchObject({ tipo: "prioridad", visible: false, texto: "P3 → P1" });
  });

  it("el cambio de estado sí lo ve el cliente; la asignación no", async () => {
    const repo = repoDemo();
    const deps = depsDemo(repo);
    const sop = await contextoDe("soporte", repo);
    await actualizarTicket(sop, deps, 1, { estado: "Esperando al cliente" });
    await tomarTicket(sop, deps, 1);
    const vista = await obtenerTicketCliente(await contextoDe("usuario", repo), deps, 1);
    expect(vista.historial.map((e) => e.texto)).toContain("Esperando al cliente");
    expect(JSON.stringify(vista)).not.toContain(sop.identidad.email);
  });

  it("publicar: verifica que el borrador sea de ese ticket y esté pendiente", async () => {
    const repo = repoDemo();
    const respuestaPublicada = vi.fn(async () => {});
    const deps = depsDemo(repo, { ticketCreado: async () => {}, respuestaPublicada });
    const sop = await contextoDe("soporte", repo);
    const borrador2 = (await repo.historial.listarPorTicket(2)).find((e) => e.tipo === "borrador_respuesta")!;
    const descartado13 = (await repo.historial.listarPorTicket(13)).find((e) => e.tipo === "borrador_respuesta")!;
    const nota2 = (await repo.historial.listarPorTicket(2)).find((e) => e.tipo === "nota_interna")!;

    // Borrador de otro ticket → 404. Una nota no es borrador → 404. Ya descartado → 409.
    expect(await resultado(() => publicarBorrador(sop, deps, 7, borrador2.id, "x"))).toBe(404);
    expect(await resultado(() => publicarBorrador(sop, deps, 2, nota2.id, "x"))).toBe(404);
    expect(await resultado(() => publicarBorrador(sop, deps, 13, descartado13.id, "x"))).toBe(409);

    await publicarBorrador(sop, deps, 2, borrador2.id, "Texto revisado por soporte.");
    expect(respuestaPublicada).toHaveBeenCalledOnce();
    expect(await resultado(() => publicarBorrador(sop, deps, 2, borrador2.id, "otra vez"))).toBe(409);

    const cliente = await obtenerTicketCliente(await contextoDe("usuario", repo), deps, 2);
    const publicado = cliente.historial.at(-1)!;
    expect(publicado).toMatchObject({ tipo: "comentario", texto: "Texto revisado por soporte.", esEquipo: true, autor: sop.identidad.nombre });

    const detalle = await obtenerTicketSoporte(sop, deps, 2);
    expect(detalle.historial.find((e) => e.id === borrador2.id)).toMatchObject({ estadoBorrador: "publicado", autorEsIA: true });
    expect(detalle.borradoresPendientes).toBe(0);
  });

  it("descartar marca el borrador y no lo publica", async () => {
    const repo = repoDemo();
    const deps = depsDemo(repo);
    const sop = await contextoDe("soporte", repo);
    const b = (await repo.historial.listarPorTicket(7)).find((e) => e.tipo === "borrador_respuesta")!;
    await descartarBorrador(sop, deps, 7, b.id);
    expect((await repo.historial.obtener(b.id))!.estadoBorrador).toBe("descartado");
    const cliente = await obtenerTicketCliente(await contextoDe("usuario2", repo), deps, 7);
    expect(cliente.historial.some((e) => e.tipo === "comentario")).toBe(false);
  });
});

describe("admin", () => {
  it("aprobar una solicitud crea el cliente y habilita el tenant", async () => {
    const repo = repoDemo();
    const admin = await contextoDe("admin", repo);
    const nadia = identidadDe("no-habilitado");
    const [s] = await repo.solicitudes.listar();
    const { clienteId } = await resolverSolicitud(admin, { repo }, s!.id, "aprobada");
    expect(clienteId).not.toBeNull();
    expect(await resolverAcceso(nadia, repo, { bhiTenantIds: [DEMO_BHI_TENANT_ID] })).toMatchObject({ tipo: "cliente", rol: "usuario" });
    expect(await resultado(() => resolverSolicitud(admin, { repo }, s!.id, "rechazada"))).toBe(409);
  });

  it("registra una sola solicitud pendiente por persona", async () => {
    const repo = repoDemo();
    const nadia = identidadDe("no-habilitado");
    const acceso = await resolverAcceso(nadia, repo, { bhiTenantIds: [DEMO_BHI_TENANT_ID] });
    await registrarSolicitudSiCorresponde(nadia, acceso, repo);
    await registrarSolicitudSiCorresponde(nadia, acceso, repo);
    expect((await repo.solicitudes.listar()).filter((s) => s.email === nadia.email)).toHaveLength(1);
  });

  it("tableros: slug único, áreas del mismo cliente, identificador inmutable", async () => {
    const repo = repoDemo();
    const admin = await contextoDe("admin", repo);
    const base = { tableroId: "nuevo-tablero", nombre: "Nuevo", clienteId: 2, areaIds: [10, 11], paginas: ["inicio"], activo: true };
    expect(await resultado(() => crearTablero(admin, { repo }, base))).toBe("ok");
    expect(await resultado(() => crearTablero(admin, { repo }, base))).toBe(409);
    expect(await resultado(() => crearTablero(admin, { repo }, { ...base, tableroId: "otro", areaIds: [20] }))).toBe(422);
    expect(await resultado(() => actualizarTablero(admin, { repo }, "nuevo-tablero", { ...base, tableroId: "cambiado" }))).toBe(422);
    // El líder de Finanzas ahora ve el tablero nuevo (está en dos áreas).
    const acceso = await resolverAcceso({ ...identidadDe("usuario"), email: "fernando.finanzas@andina.example.com" }, repo, {
      bhiTenantIds: [DEMO_BHI_TENANT_ID],
    });
    expect(acceso.tipo === "cliente" && acceso.tablerosDeAreas).toContain("nuevo-tablero");
  });
});
