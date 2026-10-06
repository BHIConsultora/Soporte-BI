import { describe, expect, it } from "vitest";
import { mutacionValida, origenValido, rutaInternaSegura, tokenCsrfValido } from "@/infra/csrf";

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

describe("token CSRF de doble envío", () => {
  const conCookie = (headers: Record<string, string>) =>
    new Request("https://soporte.example.com/api/tickets", {
      method: "POST",
      headers: { origin: "https://soporte.example.com", cookie: "otra=1; __Host-sbi_csrf=abc123def456", ...headers },
    });

  it("acepta si el header coincide con la cookie", () => {
    expect(mutacionValida(conCookie({ "x-csrf-token": "abc123def456" }))).toBe(true);
  });

  it.each([
    ["sin header", {}],
    ["header distinto", { "x-csrf-token": "otro" }],
    ["header vacío", { "x-csrf-token": "" }],
  ])("rechaza %s", (_n, h) => {
    expect(mutacionValida(conCookie(h))).toBe(false);
  });

  it("sin cookie no hay forma de acertar", () => {
    const r = new Request("https://soporte.example.com/x", { method: "POST", headers: { origin: "https://soporte.example.com" } });
    expect(tokenCsrfValido(r, "")).toBe(false);
    expect(tokenCsrfValido(r, "abc")).toBe(false);
  });

  it("token correcto pero otro origen → rechaza", () => {
    expect(mutacionValida(conCookie({ origin: "https://malo.example.com", "x-csrf-token": "abc123def456" }))).toBe(false);
  });
});
