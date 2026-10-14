import { describe, expect, it } from "vitest";
import { rutaInternaSegura } from "@/infra/rutas";

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
