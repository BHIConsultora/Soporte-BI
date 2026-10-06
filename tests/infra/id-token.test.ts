import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { validarIdToken } from "@/infra/auth/id-token";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const TID = "22222222-2222-4222-8222-222222222222";
const OTRO_TID = "33333333-3333-4333-8333-333333333333";
const OID = "44444444-4444-4444-8444-444444444444";
const NONCE = "nonce-de-prueba-123456789";

let privada: CryptoKey;
let otraPrivada: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const par = await generateKeyPair("RS256");
  privada = par.privateKey;
  otraPrivada = (await generateKeyPair("RS256")).privateKey;
  jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(par.publicKey)), kid: "k1", alg: "RS256" }] });
});

function claims(extra: JWTPayload = {}): JWTPayload {
  return {
    iss: `https://login.microsoftonline.com/${TID}/v2.0`,
    aud: CLIENT_ID,
    tid: TID,
    oid: OID,
    nonce: NONCE,
    name: "Ana Pérez",
    preferred_username: "Ana.Perez@Cliente.example.com",
    ...extra,
  };
}

async function firmar(payload: JWTPayload, clave = privada, opciones: { alg?: string; vence?: string } = {}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: opciones.alg ?? "RS256", kid: "k1" })
    .setIssuedAt()
    .setExpirationTime(opciones.vence ?? "1h")
    .sign(clave);
}

const validar = (token: string, nonce = NONCE) => validarIdToken(token, { clientId: CLIENT_ID, nonce, jwks });

describe("validación del ID token de Entra", () => {
  it("token válido → identidad normalizada", async () => {
    const r = await validar(await firmar(claims({ roles: ["Soporte"], groups: ["AAAA0000-0000-4000-8000-000000000000"] })));
    expect(r).toEqual({
      identidad: {
        oid: OID,
        tid: TID,
        email: "ana.perez@cliente.example.com",
        nombre: "Ana Pérez",
        appRoles: ["Soporte"],
        grupos: ["aaaa0000-0000-4000-8000-000000000000"],
        esInvitado: false,
      },
      gruposIncompletos: false,
    });
  });

  it("prefiere el claim email sobre preferred_username", async () => {
    const r = await validar(await firmar(claims({ email: "ana@cliente.example.com" })));
    expect(r.identidad.email).toBe("ana@cliente.example.com");
  });

  it.each([
    ["firmado con otra clave", async () => firmar(claims(), otraPrivada)],
    ["audiencia de otra app", async () => firmar(claims({ aud: "99999999-9999-4999-8999-999999999999" }))],
    ["emisor de otro tenant (tid no coincide)", async () => firmar(claims({ iss: `https://login.microsoftonline.com/${OTRO_TID}/v2.0` }))],
    ["emisor v1", async () => firmar(claims({ iss: `https://sts.windows.net/${TID}/` }))],
    ["vencido", async () => firmar(claims(), privada, { vence: "-10m" })],
    ["sin oid", async () => firmar(claims({ oid: undefined }))],
    ["sin email ni preferred_username", async () => firmar(claims({ preferred_username: undefined }))],
  ])("rechaza: %s", async (_n, crear) => {
    await expect(validar(await crear())).rejects.toThrow(/ID token inválido/);
  });

  it("rechaza un nonce distinto (replay)", async () => {
    await expect(validar(await firmar(claims()), "otro-nonce-cualquiera-123")).rejects.toThrow(/nonce/);
  });

  it("rechaza alg none", async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const sinFirma = `${enc({ alg: "none", typ: "JWT" })}.${enc({ ...claims(), exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
    await expect(validar(sinFirma)).rejects.toThrow(/ID token inválido/);
  });

  it("detecta invitados por acct = 1", async () => {
    expect((await validar(await firmar(claims({ acct: 1 })))).identidad.esInvitado).toBe(true);
    expect((await validar(await firmar(claims({ acct: 0 })))).identidad.esInvitado).toBe(false);
  });

  it("detecta invitados por idp externo aunque falte acct", async () => {
    const r = await validar(await firmar(claims({ idp: `https://sts.windows.net/${OTRO_TID}/` })));
    expect(r.identidad.esInvitado).toBe(true);
    expect((await validar(await firmar(claims({ idp: "live.com" })))).identidad.esInvitado).toBe(true);
  });

  it("marca el overage de grupos", async () => {
    const r = await validar(await firmar(claims({ _claim_names: { groups: "src1" }, _claim_sources: { src1: { endpoint: "x" } } })));
    expect(r.gruposIncompletos).toBe(true);
    expect(r.identidad.grupos).toEqual([]);
  });
});
