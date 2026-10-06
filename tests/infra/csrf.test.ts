import { describe, expect, it } from "vitest";
import { origenValido, rutaInternaSegura } from "@/infra/csrf";

const req = (origin?: string) =>
  new Request("https://soporte.example.com/api/x", { method: "POST", headers: origin ? { origin } : {} });

describe("origenValido", () => {
  it("acepta el mismo origen y APP_URL", () => {
    expect(origenValido(req("https://soporte.example.com"))).toBe(true);
    expect(origenValido(req("https://otro.example.com"), "https://otro.example.com/")).toBe(true);
  });

  it("rechaza otro origen o sin Origin", () => {
    expect(origenValido(req("https://malo.example.com"))).toBe(false);
    expect(origenValido(req("null"))).toBe(false);
    expect(origenValido(req())).toBe(false);
  });
});

describe("rutaInternaSegura (open redirect)", () => {
  it.each([
    ["/nuevo?tablero=ventas-dtc", "/nuevo?tablero=ventas-dtc"],
    ["/", "/"],
    [null, "/"],
    ["", "/"],
    ["https://malo.example.com", "/"],
    ["//malo.example.com", "/"],
    [String.raw`/\malo.example.com`, "/"],
    ["/%2F%2Fmalo.example.com", "/%2F%2Fmalo.example.com"],
    ["javascript:alert(1)", "/"],
  ])("%j → %j", (valor, esperado) => expect(rutaInternaSegura(valor)).toBe(esperado));
});
