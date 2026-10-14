# Registro de decisiones (ADR cortas)

Formato: contexto → decisión → consecuencias. Las decisiones se agregan, no se reescriben; si una cambia, se marca como reemplazada y se agrega una nueva.

---

## ADR-001 · Next.js 16 (App Router) con bun como gestor de paquetes
**Fecha:** 2026-10-06 · **Estado:** reemplazada por ADR-011

- **Contexto:** reemplazar el portal de Lovable (TanStack Start, solo frontend) por una app con backend propio (BFF) desplegada en Vercel.
- **Decisión:** Next.js 16.3 App Router, React 19.3, route handlers como API. bun solo como gestor de paquetes y para correr scripts; el runtime en Vercel es Node.
- **Consecuencias:** en Next 16 `middleware.ts` pasa a llamarse `proxy.ts`. Todas las páginas son dinámicas (la CSP con nonce lo exige).

## ADR-002 · Sesión en cookie JWE con `jose` (no `iron-session`)
**Fecha:** 2026-10-06 · **Estado:** reemplazada por ADR-011

- **Contexto:** el contexto permite `iron-session` o `jose`. El MCP (etapa 5) probablemente necesite firmar/validar tokens propios.
- **Decisión:** `jose` con JWE compacto `dir` + `A256GCM`; clave = SHA-256 de `SESSION_SECRET`. El payload se valida con zod al leerlo.
- **Consecuencias:** una sola librería criptográfica para sesión y MCP. Cambiar `SESSION_SECRET` invalida todas las sesiones (sirve como "cerrar sesión a todos").

## ADR-003 · TypeScript 6.0 (no 7)
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Contexto:** TypeScript 7 (nativo) no expone la API de JavaScript; `typescript-eslint` 8.x exige `typescript < 6.1`.
- **Decisión:** fijar `typescript ~6.0`. Next 16 soporta ambas.
- **Consecuencias:** revisar cuando `typescript-eslint` soporte TS 7.

## ADR-004 · ESLint 9 (no 10)
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Contexto:** `eslint-plugin-react` (incluido por `eslint-config-next`) falla con ESLint 10 (`context.getFilename` eliminado).
- **Decisión:** fijar `eslint ^9`.
- **Consecuencias:** revisar al actualizar `eslint-config-next`.

## ADR-005 · CSP con nonce y excepciones acotadas
**Fecha:** 2026-10-06 · **Estado:** reemplazada por ADR-011

- **Decisión:** `script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'nonce-…'`, `style-src-attr 'unsafe-inline'` (React/Radix escriben atributos `style` para posicionar popovers; un atributo `style` no ejecuta código). En desarrollo se agrega `'unsafe-eval'` a scripts y `style-src 'unsafe-inline'` porque el HMR inyecta `<style>` sin nonce. La API usa `default-src 'none'`.
- **Consecuencias:** cualquier librería que inyecte `<style>` en runtime (p. ej. sonner) debe recibir el nonce o se bloquea en producción. Se valida en e2e.

## ADR-006 · Guardia del modo demo en `next.config.ts` y en runtime
**Fecha:** 2026-10-06 · **Estado:** reemplazada por ADR-011

- **Contexto:** el build debe fallar si `DEMO_MODE=true` y `VERCEL_ENV=production`, sin depender de que el comando de build ejecute un script previo.
- **Decisión:** `assertDemoModeAllowed` se llama al cargar `next.config.ts` (lo carga cualquier `next build`) y también en `getEnv()` (runtime). Los datos demo se cargan con `import()` dinámico.
- **Consecuencias:** no hace falta `scripts/check-env.ts`. En modo demo `SESSION_SECRET` es opcional (secreto fijo de demo).

## ADR-007 · Excepción puntual en `bun audit`: GHSA-vfj7-8cjw-p6xm (braces)
**Fecha:** 2026-10-06 · **Estado:** obsoleta (ADR-011 quitó `eslint-config-next`; `bun audit` ya no reporta nada)

- **Contexto:** `braces@3.0.3` (DoS por patrones muy anidados) llega solo vía `eslint-config-next → @next/eslint-plugin-next → fast-glob`. No hay versión publicada que lo corrija. No forma parte del bundle ni del runtime: solo procesa globs de nuestro propio repo durante el lint.
- **Decisión:** CI corre `bun audit --audit-level=moderate --ignore=GHSA-vfj7-8cjw-p6xm`.
- **Consecuencias:** cualquier otra vulnerabilidad moderada o mayor rompe el CI. Quitar la excepción cuando haya versión corregida.

## ADR-008 · Personas demo como identidades del ID token
**Fecha:** 2026-10-06 · **Estado:** modificada por ADR-012

- **Decisión:** el modo demo no simula roles: simula **identidades** (oid, tid, email, app roles, grupos, invitado). La sesión demo guarda la misma estructura que guardará el login real, y `resolverAcceso` (§4.3) corre igual en ambos modos.
- **Consecuencias:** los e2e en demo ejercitan la misma lógica de autorización que producción. El cambio de persona es un `POST` de formulario con verificación de `Origin`, que solo existe en demo.

## ADR-009 · Tableros por área resueltos en el acceso
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Decisión:** `resolverAcceso` devuelve, para un líder, sus áreas activas con los `tableroIds` de cada una (y la unión). `filtroPorRol` es una función pura sobre eso.
- **Consecuencias:** las áreas de un ticket nunca se copian al ticket; un tablero compartido entre áreas aparece para los líderes de todas ellas.

## ADR-010 · Vercel: rama de producción separada hasta tener auth real
**Fecha:** 2026-10-06 · **Estado:** reemplazada por ADR-011

- **Contexto:** sin login real (etapa 2) un deploy de producción no funcionaría, y producción nunca puede tener `DEMO_MODE=true`. Se trabaja directo sobre `main`.
- **Decisión:** en Vercel, configurar como *Production Branch* una rama `produccion` (que todavía no existe). Así cada push a `main` genera un deploy de **Preview** con `DEMO_MODE=true`.
- **Consecuencias:** cuando la etapa 2 esté lista se crea `produccion` desde `main` (o se vuelve a `main` como rama de producción). Ver `DEPLOY.md`.

## ADR-011 · Frontend Vite + React Router y backend en Supabase (Lovable Cloud)
**Fecha:** 2026-10-14 · **Estado:** aceptada · Reemplaza ADR-001, 002, 005, 006 y 010

- **Contexto:** el portal se va a desplegar y mantener en Lovable, que levanta proyectos Vite + React y usa Supabase (Lovable Cloud) como backend. Next.js con route handlers y SharePoint como persistencia no corre ahí. Las apps de Entra ID para el login con Microsoft ya están creadas.
- **Decisión:**
  - SPA con Vite 8 + React 19 + React Router 8. Mismas URLs que antes; `/api/auth/*` pasa a `/auth/login`, `/auth/callback` y `/auth/logout`. Sin cambios visuales: mismo markup, clases y CSS; las fuentes pasan de `next/font` a `@fontsource-variable` (mismas familias, autoalojadas).
  - Persistencia en Postgres de Supabase: `supabase/migrations/20261014000000_modelo_inicial.sql`. Los enums usan exactamente los valores de `src/dominio/catalogos.ts`, así no hay traducción entre la UI y la base.
  - Autorización en la base: RLS en todas las tablas + `acceso_actual()` (la misma regla que `resolverAcceso`). Los campos internos del ticket viven en `ticket_soporte` (solo BHI) y las columnas internas de `cliente` (referentes, notas) no se otorgan al rol `authenticated`. Un cliente no puede escribir directo: las altas pasan por funciones `security definer` (`crear_ticket`, `elegir_cliente`, …).
  - Login: proveedor `azure` de Supabase Auth (authority `organizations`). El `tid` y el email se leen de `auth.identities`, que escribe Supabase Auth con lo que manda Entra y el usuario no puede editar (a diferencia de `user_metadata`).
  - La UI habla con una interfaz `Backend` (`src/backend/`) con dos implementaciones: Supabase y demo en memoria.
- **Consecuencias:**
  - Se abandona el principio "sin base de datos propia" y el patrón BFF: la sesión de Supabase vive en el navegador (`localStorage`). La protección de los datos pasa a ser RLS, no un servidor propio. Toda regla nueva de permisos se escribe en SQL y se prueba en `tests/supabase/`.
  - Supabase necesita un **client secret** de la app de Entra (lo guarda Supabase, nunca el repo). Se pierde la federación OIDC sin secretos de Vercel.
  - Correo, Teams, MCP y crons (etapas 4 y 5) se van a implementar como Edge Functions de Supabase.
  - La CSP pasa a un `<meta>` (ADR-013).

## ADR-012 · Personal de BHI y miembros satélite como datos, no como claims de Entra
**Fecha:** 2026-10-14 · **Estado:** aceptada · Modifica ADR-008

- **Contexto:** con Supabase Auth no hay garantía de recibir los claims `roles` (app roles) ni `groups` del ID token, y además quedarían fijos hasta el próximo login.
- **Decisión:** `personal_bhi (email, rol soporte|admin, activo)` reemplaza los app roles `Soporte`/`Admin`, y `cliente_miembro (cliente_id, email)` reemplaza los grupos de seguridad de los satélites. Ambos solo cuentan si el login viene del tenant de BHI (`configuracion.bhi_tenant_id`). Las personas demo dejan de tener app roles, grupos e invitado; la demo tiene las mismas dos listas.
- **Consecuencias:** las altas y bajas de soporte y de satélites se hacen en la base y se aplican en el próximo request. Un invitado B2B en el tenant de BHI no tiene acceso salvo que su email esté cargado (ya no se distingue "invitado").

## ADR-013 · CSP en `<meta>` solo en el build
**Fecha:** 2026-10-14 · **Estado:** aceptada · Reemplaza ADR-005

- **Contexto:** el hosting de Lovable no permite configurar headers HTTP.
- **Decisión:** un plugin de Vite agrega `<meta http-equiv="Content-Security-Policy">` en `vite build` (`src/infra/csp.ts`): `script-src 'self'` y `connect-src` limitado al proyecto de Supabase (HTTPS y WSS). En desarrollo no se aplica (el HMR de Vite inyecta scripts inline).
- **Consecuencias:** `frame-ancestors`, HSTS, `X-Frame-Options` y los demás headers no se pueden fijar desde un `<meta>`. Si hacen falta, hay que poner el dominio propio detrás de un proxy (p. ej. Cloudflare) que los agregue.

## ADR-014 · La migración se prueba contra la lógica TypeScript
**Fecha:** 2026-10-14 · **Estado:** aceptada

- **Decisión:** `tests/supabase/` levanta Postgres en memoria con PGlite, simula lo mínimo de Supabase (`auth.users`, `auth.identities`, `auth.uid()`, roles, `storage`), aplica las migraciones, carga los datos demo y compara `acceso_actual()` y la RLS de `ticket` con `resolverAcceso`/`listarTickets` para cada persona. Corre en `bun run test` y en CI.
- **Consecuencias:** si alguien cambia la regla de acceso de un lado y no del otro, el CI falla.
