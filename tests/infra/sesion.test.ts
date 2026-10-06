import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/infra/env";
import { cifrarSesion, descifrarSesion, type Sesion } from "@/infra/sesion";

const sesion: Sesion = {
  identidad: { oid: "o", tid: "t", email: "a@example.com", nombre: "A", appRoles: [], grupos: [], esInvitado: false },
  clienteElegidoId: null,
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
    expect(await descifrarSesion(token)).toEqual(sesion);
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
});
