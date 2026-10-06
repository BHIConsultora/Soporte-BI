import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/infra/env";
import { cifrarSesion, debeRenovar, descifrarSesion, type Sesion } from "@/infra/sesion";

const sesion: Sesion = {
  identidad: { oid: "o", tid: "t", email: "a@example.com", nombre: "A", appRoles: [], grupos: [], esInvitado: false },
  clienteElegidoId: null,
  inicio: Math.floor(Date.now() / 1000),
};

describe("sesión cifrada", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it("ida y vuelta", async () => {
    const token = await cifrarSesion(sesion);
    expect(token.split(".")).toHaveLength(5); // JWE compacto
    expect(token).not.toContain("a@example.com");
    expect(await descifrarSesion(token)).toMatchObject(sesion);
  });

  it("rechaza un token alterado o cifrado con otro secreto", async () => {
    const token = await cifrarSesion(sesion);
    const alterado = token.slice(0, -4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(await descifrarSesion(alterado)).toBeNull();

    vi.stubEnv("SESSION_SECRET", "y".repeat(40));
    resetEnvCache();
    expect(await descifrarSesion(token)).toBeNull();
  });

  it("rechaza basura", async () => {
    expect(await descifrarSesion("no-es-un-jwe")).toBeNull();
  });

  it("tope absoluto: a las 24 h del login ya no sirve aunque se haya renovado", async () => {
    const hace25h = Math.floor(Date.now() / 1000) - 25 * 3600;
    const token = await cifrarSesion({ ...sesion, inicio: hace25h });
    expect(await descifrarSesion(token)).toBeNull();
    const hace23h = Math.floor(Date.now() / 1000) - 23 * 3600;
    expect(await descifrarSesion(await cifrarSesion({ ...sesion, inicio: hace23h }))).not.toBeNull();
  });

  it("renovación deslizante: se reemite pasados 10 minutos", () => {
    const ahora = Date.now();
    expect(debeRenovar(Math.floor(ahora / 1000) - 60, ahora)).toBe(false);
    expect(debeRenovar(Math.floor(ahora / 1000) - 11 * 60, ahora)).toBe(true);
  });
});
