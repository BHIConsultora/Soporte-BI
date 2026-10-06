# Registro de decisiones (ADR cortas)

Formato: contexto → decisión → consecuencias. Las decisiones se agregan, no se reescriben; si una cambia, se marca como reemplazada y se agrega una nueva.

---

## ADR-001 · Next.js 16 (App Router) con bun como gestor de paquetes
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Contexto:** reemplazar el portal de Lovable (TanStack Start, solo frontend) por una app con backend propio (BFF) desplegada en Vercel.
- **Decisión:** Next.js 16.3 App Router, React 19.3, route handlers como API. bun solo como gestor de paquetes y para correr scripts; el runtime en Vercel es Node.
- **Consecuencias:** en Next 16 `middleware.ts` pasa a llamarse `proxy.ts`. Todas las páginas son dinámicas (la CSP con nonce lo exige).

## ADR-002 · Sesión en cookie JWE con `jose` (no `iron-session`)
**Fecha:** 2026-10-06 · **Estado:** aceptada

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
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Decisión:** `script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'nonce-…'`, `style-src-attr 'unsafe-inline'` (React/Radix escriben atributos `style` para posicionar popovers; un atributo `style` no ejecuta código). En desarrollo se agrega `'unsafe-eval'` a scripts y `style-src 'unsafe-inline'` porque el HMR inyecta `<style>` sin nonce. La API usa `default-src 'none'`.
- **Consecuencias:** cualquier librería que inyecte `<style>` en runtime (p. ej. sonner) debe recibir el nonce o se bloquea en producción. Se valida en e2e.

## ADR-006 · Guardia del modo demo en `next.config.ts` y en runtime
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Contexto:** el build debe fallar si `DEMO_MODE=true` y `VERCEL_ENV=production`, sin depender de que el comando de build ejecute un script previo.
- **Decisión:** `assertDemoModeAllowed` se llama al cargar `next.config.ts` (lo carga cualquier `next build`) y también en `getEnv()` (runtime). Los datos demo se cargan con `import()` dinámico.
- **Consecuencias:** no hace falta `scripts/check-env.ts`. En modo demo `SESSION_SECRET` es opcional (secreto fijo de demo).

## ADR-007 · Excepción puntual en `bun audit`: GHSA-vfj7-8cjw-p6xm (braces)
**Fecha:** 2026-10-06 · **Estado:** aceptada (revisar mensualmente)

- **Contexto:** `braces@3.0.3` (DoS por patrones muy anidados) llega solo vía `eslint-config-next → @next/eslint-plugin-next → fast-glob`. No hay versión publicada que lo corrija. No forma parte del bundle ni del runtime: solo procesa globs de nuestro propio repo durante el lint.
- **Decisión:** CI corre `bun audit --audit-level=moderate --ignore=GHSA-vfj7-8cjw-p6xm`.
- **Consecuencias:** cualquier otra vulnerabilidad moderada o mayor rompe el CI. Quitar la excepción cuando haya versión corregida.

## ADR-008 · Personas demo como identidades del ID token
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Decisión:** el modo demo no simula roles: simula **identidades** (oid, tid, email, app roles, grupos, invitado). La sesión demo guarda la misma estructura que guardará el login real, y `resolverAcceso` (§4.3) corre igual en ambos modos.
- **Consecuencias:** los e2e en demo ejercitan la misma lógica de autorización que producción. El cambio de persona es un `POST` de formulario con verificación de `Origin`, que solo existe en demo.

## ADR-009 · Tableros por área resueltos en el acceso
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Decisión:** `resolverAcceso` devuelve, para un líder, sus áreas activas con los `tableroIds` de cada una (y la unión). `filtroPorRol` es una función pura sobre eso.
- **Consecuencias:** las áreas de un ticket nunca se copian al ticket; un tablero compartido entre áreas aparece para los líderes de todas ellas.

## ADR-010 · Vercel: rama de producción separada hasta tener auth real
**Fecha:** 2026-10-06 · **Estado:** propuesta (requiere acción del admin de Vercel)

- **Contexto:** sin login real (etapa 2) un deploy de producción no funcionaría, y producción nunca puede tener `DEMO_MODE=true`. Se trabaja directo sobre `main`.
- **Decisión:** en Vercel, configurar como *Production Branch* una rama `produccion` (que todavía no existe). Así cada push a `main` genera un deploy de **Preview** con `DEMO_MODE=true`.
- **Consecuencias:** cuando la etapa 2 esté lista se crea `produccion` desde `main` (o se vuelve a `main` como rama de producción). Ver `DEPLOY.md`.
