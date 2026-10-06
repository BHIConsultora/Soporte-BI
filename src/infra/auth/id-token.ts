import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import type { Identidad } from "@/servicios/acceso";

/**
 * Validación propia del ID token de Entra ID (además de lo que hace MSAL):
 * firma RS256 contra las claves públicas de Microsoft, audiencia = app Portal,
 * emisor construido con el `tid` del propio token (app multi-tenant), nonce, `exp`/`nbf`.
 * La identidad sale SOLO de acá.
 */

const JWKS_URL = new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys");
let jwksRemoto: JWTVerifyGetKey | undefined;
const jwksPorDefecto = () => (jwksRemoto ??= createRemoteJWKSet(JWKS_URL, { cooldownDuration: 30_000, cacheMaxAge: 6 * 3_600_000 }));

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const claimsSchema = z.object({
  oid: z.string().regex(GUID),
  tid: z.string().regex(GUID),
  nonce: z.string(),
  name: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  preferred_username: z.string().max(320).optional(),
  roles: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
  /** Claim opcional: 0 = miembro, 1 = invitado. */
  acct: z.number().optional(),
  /** Presente cuando el usuario se autenticó en otro proveedor (invitados B2B, cuentas personales). */
  idp: z.string().optional(),
  /** Overage de grupos: el token no trae la lista completa. */
  _claim_names: z.object({ groups: z.string().optional() }).loose().optional(),
});

export interface ResultadoIdToken {
  identidad: Identidad;
  /** El token no trajo los grupos (más de 200): hay que pedirlos a Graph. */
  gruposIncompletos: boolean;
}

export class IdTokenInvalido extends Error {
  constructor(motivo: string) {
    super(`ID token inválido: ${motivo}`);
    this.name = "IdTokenInvalido";
  }
}

export async function validarIdToken(
  idToken: string,
  { clientId, nonce, jwks = jwksPorDefecto(), ahora }: { clientId: string; nonce: string; jwks?: JWTVerifyGetKey; ahora?: Date },
): Promise<ResultadoIdToken> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      algorithms: ["RS256"],
      audience: clientId,
      clockTolerance: 120,
      ...(ahora && { currentDate: ahora }),
    }));
  } catch (err) {
    throw new IdTokenInvalido(err instanceof Error ? err.name : "firma");
  }

  const c = claimsSchema.safeParse(payload);
  if (!c.success) throw new IdTokenInvalido("faltan claims");
  const claims = c.data;

  // Multi-tenant: el emisor tiene que ser el del tenant que dice el propio token.
  const emisorEsperado = `https://login.microsoftonline.com/${claims.tid}/v2.0`;
  if (payload.iss !== emisorEsperado) throw new IdTokenInvalido("emisor");
  if (claims.nonce !== nonce) throw new IdTokenInvalido("nonce");

  const email = (claims.email ?? claims.preferred_username ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new IdTokenInvalido("sin email");

  // Invitado: `acct = 1`, o un `idp` distinto del emisor (se autenticó en su organización de origen).
  const idpExterno = !!claims.idp && claims.idp !== emisorEsperado && !claims.idp.includes(claims.tid);
  const esInvitado = claims.acct === 1 || idpExterno;

  return {
    identidad: {
      oid: claims.oid.toLowerCase(),
      tid: claims.tid.toLowerCase(),
      email,
      nombre: claims.name?.trim() || email,
      appRoles: claims.roles ?? [],
      grupos: (claims.groups ?? []).map((g) => g.toLowerCase()),
      esInvitado,
    },
    gruposIncompletos: !!claims._claim_names?.groups,
  };
}
