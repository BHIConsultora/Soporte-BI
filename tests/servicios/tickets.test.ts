import { describe, expect, it } from "vitest";
import { CLIENTE } from "@/repositorio/demo/datos";
import { listarTickets } from "@/servicios/tickets";
import { contextoDe, identidadDe, repoDemo } from "./helpers";

async function ids(clave: string, vista?: string) {
  const repo = repoDemo();
  const { items } = await listarTickets(await contextoDe(clave, repo), repo, vista ? { vista } : {});
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

  it("referente: ve todo su cliente y nada de otros", async () => {
    const lista = await ids("referente", "org");
    expect(lista).toEqual(["TCK-0001", "TCK-0002", "TCK-0003", "TCK-0004", "TCK-0005", "TCK-0006", "TCK-0007", "TCK-0008", "TCK-0015"]);
  });

  it("satélite: solo su cliente", async () => {
    expect(await ids("satelite", "org")).toEqual(["TCK-0012"]);
  });

  it("soporte ve todos los tickets", async () => {
    expect(await ids("soporte")).toHaveLength(15);
  });

  it("el DTO de cliente no trae campos internos", async () => {
    const repo = repoDemo();
    const { items } = await listarTickets(await contextoDe("referente", repo), repo, { vista: "org" });
    for (const t of items) {
      for (const campo of ["categoria", "resumenIA", "procesadoIA", "asignadoA", "autorEmail", "venceSLA", "contexto"]) {
        expect(t).not.toHaveProperty(campo);
      }
    }
    expect(items.find((t) => t.ticketId === "TCK-0015")).toMatchObject({ esAutor: true });
  });

  it("el DTO de soporte sí trae los campos internos", async () => {
    const repo = repoDemo();
    const { items } = await listarTickets(await contextoDe("soporte", repo), repo);
    expect(items.find((t) => t.ticketId === "TCK-0002")).toMatchObject({ procesadoIA: true, asignadoA: identidadDe("soporte").email });
  });

  it("todos los tickets de un rol de cliente son de su cliente", async () => {
    const repo = repoDemo();
    const { items } = await listarTickets(await contextoDe("litoral", repo), repo, { vista: "org" });
    expect(items.every((t) => t.cliente === "Cooperativa del Litoral")).toBe(true);
    expect(CLIENTE.litoral).toBe(3);
  });
});
