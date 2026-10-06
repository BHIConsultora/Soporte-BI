import { describe, expect, it } from "vitest";
import { listarTickets, resumenTickets } from "@/servicios/tickets";
import { contextoDe, depsDemo, identidadDe, repoDemo } from "./helpers";

async function ids(clave: string, vista?: string) {
  const repo = repoDemo();
  const { items } = await listarTickets(await contextoDe(clave, repo), depsDemo(repo), vista ? { vista } : {});
  return items.map((t) => t.ticketId).sort();
}

describe("listado de tickets por rol (§5)", () => {
  it("usuario: solo los suyos, aunque pida la vista de organización o un área", async () => {
    const mios = ["TCK-0001", "TCK-0002", "TCK-0008"];
    expect(await ids("usuario")).toEqual(mios);
    expect(await ids("usuario", "org")).toEqual(mios);
    expect(await ids("usuario", "area:10")).toEqual(mios);
  });

  it("líder: área Comercial incluye el tablero compartido con Finanzas", async () => {
    // ventas-dtc (1, 2, 6) + margen-por-canal (3, 7), compartido con Finanzas.
    expect(await ids("lider", "area:10")).toEqual(["TCK-0001", "TCK-0002", "TCK-0003", "TCK-0006", "TCK-0007"]);
  });

  it("líder: no puede ver un área que no lidera (recorta a los suyos)", async () => {
    expect(await ids("lider", "area:11")).toEqual(["TCK-0006"]);
  });

  it("líder: vista org = propios + tableros de sus áreas", async () => {
    expect(await ids("lider", "org")).toEqual(["TCK-0001", "TCK-0002", "TCK-0003", "TCK-0006", "TCK-0007"]);
  });

  it("referente: ve todo su cliente y nada de otros", async () => {
    expect(await ids("referente", "org")).toEqual([
      "TCK-0001",
      "TCK-0002",
      "TCK-0003",
      "TCK-0004",
      "TCK-0005",
      "TCK-0006",
      "TCK-0007",
      "TCK-0008",
      "TCK-0015",
    ]);
  });

  it("referente sin vista org ve solo los suyos", async () => {
    expect(await ids("referente")).toEqual(["TCK-0005", "TCK-0015"]);
  });

  it("satélite: solo su cliente", async () => {
    expect(await ids("satelite", "org")).toEqual(["TCK-0012"]);
  });

  it("soporte ve todos los tickets", async () => {
    const repo = repoDemo();
    const { items } = await listarTickets(await contextoDe("soporte", repo), depsDemo(repo));
    expect(items).toHaveLength(15);
  });

  it("filtra por estado y texto sin salirse del alcance", async () => {
    const repo = repoDemo();
    const ctx = await contextoDe("referente", repo);
    const { items } = await listarTickets(ctx, depsDemo(repo), { vista: "org", estados: ["Nuevo"], q: "stock" });
    expect(items.map((t) => t.ticketId)).toEqual(["TCK-0015"]);
    const porId = await listarTickets(ctx, depsDemo(repo), { vista: "org", q: "TCK-0009" });
    expect(porId.items).toEqual([]);
  });

  it("el DTO de cliente no trae campos internos", async () => {
    const repo = repoDemo();
    const { items } = await listarTickets(await contextoDe("referente", repo), depsDemo(repo), { vista: "org" });
    for (const t of items) {
      for (const campo of ["categoria", "resumenIA", "procesadoIA", "asignadoA", "autorEmail", "venceSLA", "contexto"]) {
        expect(t).not.toHaveProperty(campo);
      }
    }
    expect(items.find((t) => t.ticketId === "TCK-0015")).toMatchObject({ esAutor: true });
  });

  it("el DTO de soporte sí trae los campos internos", async () => {
    const repo = repoDemo();
    const { items } = await listarTickets(await contextoDe("soporte", repo), depsDemo(repo));
    expect(items.find((t) => t.ticketId === "TCK-0002")).toMatchObject({ procesadoIA: true, asignadoA: identidadDe("soporte").email });
  });
});

describe("resumen de Mis reclamos", () => {
  it("cuenta solo los propios, aunque el rol vea más", async () => {
    const repo = repoDemo();
    expect(await resumenTickets(await contextoDe("usuario", repo), depsDemo(repo))).toEqual({ abiertos: 2, esperandoRespuesta: 0, resueltosDelMes: 0 });
    // Paula: TCK-3 (esperando), TCK-4 (nuevo), TCK-7 (análisis).
    expect(await resumenTickets(await contextoDe("usuario2", repo), depsDemo(repo))).toEqual({ abiertos: 3, esperandoRespuesta: 1, resueltosDelMes: 0 });
    // Ramiro: TCK-5 resuelto hace 3 días (octubre) + TCK-15 nuevo.
    expect(await resumenTickets(await contextoDe("referente", repo), depsDemo(repo))).toEqual({ abiertos: 1, esperandoRespuesta: 0, resueltosDelMes: 1 });
  });

  it("no existe para soporte", async () => {
    const repo = repoDemo();
    await expect(resumenTickets(await contextoDe("soporte", repo), depsDemo(repo))).rejects.toMatchObject({ status: 403 });
  });
});
