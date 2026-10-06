import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gruposPorOverage } from "@/infra/auth/grupos";
import { resetEnvCache } from "@/infra/env";
import { demoraReintento, ErrorGraph, graph, graphTodas, type OpcionesGraph } from "@/infra/graph/cliente";

const respuesta = (status: number, cuerpo: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json", ...headers } });

function opciones(respuestas: Response[]): OpcionesGraph & { llamadas: string[]; esperas: number[] } {
  const llamadas: string[] = [];
  const esperas: number[] = [];
  return {
    llamadas,
    esperas,
    token: async () => "token-de-prueba",
    esperar: async (ms) => {
      esperas.push(ms);
    },
    fetch: (async (url: string, init: RequestInit) => {
      llamadas.push(`${init.method ?? "GET"} ${url} ${new Headers(init.headers).get("Authorization")}`);
      const r = respuestas.shift();
      if (!r) throw new Error("sin respuesta");
      return r;
    }) as unknown as typeof fetch,
  };
}

describe("cliente de Graph", () => {
  it("manda el token de app y devuelve el JSON", async () => {
    const o = opciones([respuesta(200, { id: "x" })]);
    expect(await graph("/sites/root", {}, o)).toEqual({ id: "x" });
    expect(o.llamadas).toEqual(["GET https://graph.microsoft.com/v1.0/sites/root Bearer token-de-prueba"]);
  });

  it("reintenta ante 429 respetando Retry-After, y ante 503", async () => {
    const o = opciones([respuesta(429, {}, { "Retry-After": "3" }), respuesta(503), respuesta(200, { ok: 1 })]);
    expect(await graph("/x", {}, o)).toEqual({ ok: 1 });
    expect(o.esperas[0]).toBe(3000);
    expect(o.esperas).toHaveLength(2);
  });

  it("no reintenta errores definitivos y no filtra el cuerpo", async () => {
    const o = opciones([respuesta(403, { error: { code: "accessDenied", message: "datos sensibles del sitio" } })]);
    const err = await graph("/x", {}, o).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ErrorGraph);
    expect((err as ErrorGraph).message).toBe("Graph respondió 403 (accessDenied)");
    expect((err as ErrorGraph).message).not.toContain("sensibles");
  });

  it("corta después del máximo de reintentos", async () => {
    const o = { ...opciones([respuesta(429), respuesta(429), respuesta(429)]), maxReintentos: 2 };
    await expect(graph("/x", {}, o)).rejects.toMatchObject({ status: 429 });
  });

  it("no acepta URLs fuera de Graph", async () => {
    await expect(graph("https://malo.example.com/x", {}, opciones([]))).rejects.toThrow(/inválida/);
  });

  it("recorre @odata.nextLink", async () => {
    const o = opciones([
      respuesta(200, { value: [1, 2], "@odata.nextLink": "https://graph.microsoft.com/v1.0/x?$skiptoken=a" }),
      respuesta(200, { value: [3] }),
    ]);
    expect(await graphTodas<number>("/x", o)).toEqual([1, 2, 3]);
  });

  it("demora: Retry-After en segundos, en fecha, o backoff con tope", () => {
    expect(demoraReintento(0, "2")).toBe(2000);
    expect(demoraReintento(0, new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(demoraReintento(0, "999")).toBe(60_000);
    expect(demoraReintento(10, null)).toBeLessThanOrEqual(8_250);
  });
});

describe("overage de grupos", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("DATA_CLIENT_ID", "cccccccc-0000-4000-8000-000000000000");
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it("consulta solo los grupos configurados, de a 20", async () => {
    const grupos = Array.from({ length: 25 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    const o = opciones([respuesta(200, { value: [grupos[3]!.toUpperCase()] }), respuesta(200, { value: [] })]);
    expect(await gruposPorOverage("oid-1", grupos, o)).toEqual([grupos[3]]);
    expect(o.llamadas).toHaveLength(2);
    expect(o.llamadas[0]).toContain("/users/oid-1/checkMemberGroups");
  });

  it("si Graph falla, sigue sin grupos (el usuario queda sin acceso, no con acceso de más)", async () => {
    expect(await gruposPorOverage("oid-1", ["g"], opciones([respuesta(403)]))).toEqual([]);
  });
});
