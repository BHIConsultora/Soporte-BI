import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { destinoPorError, urlPorDestino } from "@/infra/auth/errores-entra";
import { cifrarTransaccion, descifrarTransaccion, nuevaTransaccion } from "@/infra/auth/transaccion";
import { accesoConCache, claveAcceso, invalidarAcceso, limpiarCacheAcceso } from "@/infra/cache-acceso";
import { cifrar } from "@/infra/cripto";
import { getEnv, requerirVariable, resetEnvCache } from "@/infra/env";
import type { Acceso } from "@/servicios/acceso";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  resetEnvCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe("transacción de login (state, nonce, PKCE)", () => {
  it("PKCE S256: el challenge es SHA-256 del verifier", async () => {
    const { transaccion, codeChallenge } = await nuevaTransaccion("/nuevo?tablero=ventas-dtc");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(transaccion.codeVerifier));
    expect(codeChallenge).toBe(Buffer.from(digest).toString("base64url"));
    expect(transaccion.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(transaccion.state).not.toBe(transaccion.nonce);
  });

  it("ida y vuelta conservando la URL de retorno (con ?tablero=)", async () => {
    const { transaccion } = await nuevaTransaccion("/nuevo?tablero=ventas-dtc&pagina=resumen");
    expect(await descifrarTransaccion(await cifrarTransaccion(transaccion))).toEqual(transaccion);
  });

  it("una cookie de sesión no sirve como transacción (claves por propósito)", async () => {
    const { transaccion } = await nuevaTransaccion("/");
    const comoSesion = await cifrar({ ...transaccion }, "sesion", 600);
    expect(await descifrarTransaccion(comoSesion)).toBeNull();
    expect(await descifrarTransaccion(undefined)).toBeNull();
    expect(await descifrarTransaccion("basura")).toBeNull();
  });
});

describe("errores de Entra ID", () => {
  it.each([
    ["consent_required", "", "consentimiento"],
    ["invalid_client", "AADSTS65001: The user or administrator has not consented", "consentimiento"],
    ["access_denied", "AADSTS65004: User declined to consent", "consentimiento"],
    ["invalid_grant", "AADSTS90094: admin consent required", "consentimiento"],
    ["unauthorized_client", "AADSTS700016: Application not found in the directory", "consentimiento"],
    ["access_denied", "AADSTS50105: The signed in user is not assigned to a role", "no_asignado"],
    ["invalid_request", "AADSTS50020: User account from identity provider does not exist", "no_asignado"],
    ["access_denied", "The user canceled the authentication", "cancelado"],
    ["server_error", "algo raro", "reintentar"],
  ])("%s / %s → %s", (error, descripcion, esperado) => {
    expect(destinoPorError(error, descripcion)).toBe(esperado);
  });

  it("cada destino lleva a una pantalla interna", () => {
    expect(urlPorDestino("consentimiento")).toBe("/consentimiento");
    expect(urlPorDestino("no_asignado")).toBe("/no-habilitado?motivo=sin_permiso");
  });
});

describe("caché del acceso", () => {
  const acceso: Acceso = { tipo: "bhi", rol: "soporte" };
  const yo = { tid: "t", oid: "o" };
  afterEach(() => limpiarCacheAcceso());

  it("reutiliza dentro del TTL y vuelve a resolver al vencer", async () => {
    let reloj = 0;
    const resolver = vi.fn(async () => acceso);
    const clave = claveAcceso(yo, null);
    await accesoConCache(clave, 120, resolver, () => reloj);
    await accesoConCache(clave, 120, resolver, () => reloj);
    expect(resolver).toHaveBeenCalledTimes(1);
    reloj = 121_000;
    await accesoConCache(clave, 120, resolver, () => reloj);
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("TTL 0 (demo) no cachea; los denegados nunca se cachean", async () => {
    const resolver = vi.fn(async () => acceso);
    await accesoConCache("a", 0, resolver);
    await accesoConCache("a", 0, resolver);
    expect(resolver).toHaveBeenCalledTimes(2);
    const denegado = vi.fn(async (): Promise<Acceso> => ({ tipo: "denegado", code: "tenant_no_habilitado" }));
    await accesoConCache("b", 120, denegado);
    await accesoConCache("b", 120, denegado);
    expect(denegado).toHaveBeenCalledTimes(2);
  });

  it("invalidar borra lo de esa persona (todos sus clientes)", async () => {
    const resolver = vi.fn(async () => acceso);
    await accesoConCache(claveAcceso(yo, 1), 120, resolver);
    await accesoConCache(claveAcceso(yo, 2), 120, resolver);
    invalidarAcceso(yo);
    await accesoConCache(claveAcceso(yo, 1), 120, resolver);
    expect(resolver).toHaveBeenCalledTimes(3);
  });
});

describe("variables de entorno", () => {
  it("producción exige lo mínimo del login real", () => {
    vi.stubEnv("DEMO_MODE", "");
    resetEnvCache();
    expect(() => getEnv()).toThrow(/APP_URL|SESSION_SECRET|BHI_TENANT_ID|PORTAL_CLIENT_ID/);
  });

  it("producción con lo mínimo arranca y normaliza", () => {
    vi.stubEnv("DEMO_MODE", "");
    vi.stubEnv("APP_URL", "https://soporte.example.com/");
    vi.stubEnv("BHI_TENANT_ID", "AAAAAAAA-0000-4000-8000-000000000000");
    vi.stubEnv("PORTAL_CLIENT_ID", "bbbbbbbb-0000-4000-8000-000000000000");
    resetEnvCache();
    const env = getEnv();
    expect(env).toMatchObject({ demo: false, APP_URL: "https://soporte.example.com", BHI_TENANT_ID: "aaaaaaaa-0000-4000-8000-000000000000" });
    expect(() => requerirVariable("SP_SITE_ID")).toThrow(/SP_SITE_ID/);
  });

  it("demo sin variables de Entra funciona con secreto de demo", () => {
    vi.stubEnv("SESSION_SECRET", "");
    resetEnvCache();
    expect(getEnv()).toMatchObject({ demo: true });
    expect(getEnv().SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
