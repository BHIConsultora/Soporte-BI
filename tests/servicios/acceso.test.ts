import { describe, expect, it } from "vitest";
import { CLIENTE, DEMO_BHI_TENANT_ID, DEMO_TENANT_ANDINA } from "@/repositorio/demo/datos";
import { resolverAcceso } from "@/servicios/acceso";
import { identidadDe, repoDemo } from "./helpers";

const opciones = { bhiTenantId: DEMO_BHI_TENANT_ID };

describe("resolución de acceso (§4.3)", () => {
  it.each([
    ["usuario", "cliente", "usuario"],
    ["lider", "cliente", "lider"],
    ["referente", "cliente", "referente"],
    ["litoral", "cliente", "usuario"],
    ["satelite", "cliente", "usuario"],
    ["soporte", "bhi", "soporte"],
    ["admin", "bhi", "admin"],
  ])("%s → %s/%s", async (clave, tipo, rol) => {
    const acceso = await resolverAcceso(identidadDe(clave), repoDemo(), opciones);
    expect(acceso).toMatchObject({ tipo, rol });
  });

  it("cuenta del tenant de BHI que no es personal ni satélite (p. ej. invitado) → sin_permiso", async () => {
    expect(await resolverAcceso(identidadDe("invitado"), repoDemo(), opciones)).toEqual({ tipo: "denegado", code: "sin_permiso" });
  });

  it("tenant no habilitado → tenant_no_habilitado", async () => {
    expect(await resolverAcceso(identidadDe("no-habilitado"), repoDemo(), opciones)).toEqual({
      tipo: "denegado",
      code: "tenant_no_habilitado",
    });
  });

  it("miembro de BHI sin rol ni membresía satélite → sin_permiso", async () => {
    const id = { ...identidadDe("satelite"), email: "otra.persona@bhi.example.com" };
    expect(await resolverAcceso(id, repoDemo(), opciones)).toEqual({ tipo: "denegado", code: "sin_permiso" });
  });

  it("el personal de BHI solo cuenta dentro del tenant de BHI", async () => {
    const id = { ...identidadDe("soporte"), tid: DEMO_TENANT_ANDINA };
    expect(await resolverAcceso(id, repoDemo(), opciones)).toMatchObject({ tipo: "cliente", rol: "usuario" });
  });

  it("las membresías satélite solo cuentan dentro del tenant de BHI", async () => {
    const id = { ...identidadDe("no-habilitado"), email: identidadDe("satelite").email };
    expect(await resolverAcceso(id, repoDemo(), opciones)).toMatchObject({ tipo: "denegado" });
  });

  it("satélite en dos clientes: pide elegir y valida la elección", async () => {
    const repo = repoDemo();
    const id = identidadDe("satelite-multi");
    expect(await resolverAcceso(id, repo, opciones)).toMatchObject({ tipo: "elegir_cliente" });
    expect(await resolverAcceso(id, repo, { ...opciones, clienteElegidoId: CLIENTE.patagonia })).toMatchObject({
      tipo: "cliente",
      cliente: { id: CLIENTE.patagonia },
    });
    // Elegir un cliente al que no pertenece no abre nada: vuelve a pedir elección.
    expect(await resolverAcceso(id, repo, { ...opciones, clienteElegidoId: CLIENTE.andina })).toMatchObject({
      tipo: "elegir_cliente",
    });
  });

  it("compara emails sin distinguir mayúsculas", async () => {
    const id = { ...identidadDe("referente"), email: "RAMIRO.Referente@Andina.Example.com" };
    expect(await resolverAcceso(id, repoDemo(), opciones)).toMatchObject({ rol: "referente" });
  });

  it("el líder trae los tableros de sus áreas, incluido el compartido", async () => {
    const acceso = await resolverAcceso(identidadDe("lider"), repoDemo(), opciones);
    expect(acceso.tipo === "cliente" && acceso.tablerosDeAreas.sort()).toEqual(["margen-por-canal", "ventas-dtc"]);
  });
});
