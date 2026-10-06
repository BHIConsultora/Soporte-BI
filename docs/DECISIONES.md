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
**Fecha:** 2026-10-06 · **Estado:** reemplazada por ADR-011

- **Contexto:** sin login real (etapa 2) un deploy de producción no funcionaría, y producción nunca puede tener `DEMO_MODE=true`. Se trabaja directo sobre `main`.
- **Decisión:** en Vercel, configurar como *Production Branch* una rama `produccion` (que todavía no existe). Así cada push a `main` genera un deploy de **Preview** con `DEMO_MODE=true`.
- **Consecuencias:** cuando la etapa 2 esté lista se crea `produccion` desde `main` (o se vuelve a `main` como rama de producción). Ver `DEPLOY.md`.

## ADR-011 · Se trabaja sobre la rama `demo`
**Fecha:** 2026-10-06 · **Estado:** aceptada (pedido de Martín)

- **Contexto:** en Vercel no aparece la opción para cambiar la *Production Branch*, así que ADR-010 no se puede aplicar. `main` es la rama de producción de Vercel.
- **Decisión:** todo el desarrollo pasa a la rama `demo`. Vercel la despliega como **Preview**, donde se lee `DEMO_MODE=true`. `main` queda congelada en el cierre de la etapa 0 y solo se actualiza cuando haya auth real y se decida pasar a producción. El CI corre en `main` y en `demo`. Se mantienen las reglas: commits chicos, nada de reescribir historia, checks en verde antes de cada push.
- **Consecuencias:** el deploy de producción de `main` no tiene `DEMO_MODE` ni credenciales: hasta la etapa 2 responde con error al entrar (es esperable; no usarlo). Para pasar a producción se hace un merge de `demo` a `main` (sin *force push*).

## ADR-012 · Sin sonner ni Radix Dialog: `<dialog>` nativo y avisos en línea
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Contexto:** sonner y Radix Dialog (vía `react-remove-scroll`) insertan `<style>` en runtime sin nonce; la CSP de producción los bloquea (ADR-005).
- **Decisión:** modales con `<dialog>` nativo (`showModal()`: foco atrapado, fondo inerte y Escape cierran sin código extra) en `components/ui/dialogo.tsx`. Los resultados de acciones se anuncian con mensajes en línea (`role="status"` / `role="alert"`). Se quitó `sonner`.
- **Consecuencias:** cero violaciones de CSP en consola. Si más adelante se quiere un "toast", se hace propio con la misma técnica.

## ADR-013 · Cálculo del SLA
**Fecha:** 2026-10-06 · **Estado:** aceptada (a confirmar con Martín)

- **Decisión:** horario hábil lun–vie 9–18 h (9 h por día) en Buenos Aires, sin los días de "Feriados BI".
  - P1: fin del día hábil en que entra (si entra fuera de horario, fin del siguiente día hábil).
  - P2 / P3: 24 / 72 **horas hábiles** literales (P2 ≈ 2,7 días hábiles; P3 = 8 días hábiles).
  - P4: sin vencimiento.
  - El vencimiento se recalcula **desde la fecha de alta** al cambiar la prioridad.
  - Semáforo por minutos hábiles: verde > 50 % restante, amarillo ≤ 50 %, rojo vencido. Solo para tickets abiertos.
- **Consecuencias:** si se prefiere "24 h hábiles = 1 día hábil" y "72 h = 3 días hábiles", es cambiar `HORAS_HABILES` en `dominio/sla.ts` y sus tests.

## ADR-014 · Reglas de ciclo de vida
**Fecha:** 2026-10-06 · **Estado:** aceptada

- Si el autor responde con el ticket en "Esperando al cliente", vuelve solo a "En análisis".
- Un ticket "Cerrado" no admite comentarios (409): se pide crear uno nuevo.
- Publicar un borrador crea un comentario visible **a nombre de la persona de soporte que publica** (no de Claude) y marca el borrador como `publicado` con el texto final.
- Los cambios de estado los ve el cliente; prioridad y asignación son internos.
- Las tarjetas de "Mis reclamos" (abiertos, esperando tu respuesta, resueltos del mes) se calculan siempre sobre los tickets **propios**, aunque el rol vea más.

## ADR-015 · Adjuntos
**Fecha:** 2026-10-06 · **Estado:** aceptada

- Los adjuntos del alta quedan en la entrada inicial del historial; los de cada respuesta, en su comentario.
- Un cliente solo puede bajar adjuntos de entradas que ve; soporte, todos los del ticket. La descarga es siempre por `/api/adjuntos/:id` con `attachment`, `nosniff` y `sandbox`.
- El contenido se valida antes de crear el ticket, para no dejar tickets a medias.

## ADR-016 · Repositorio demo compartido y e2e en serie
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Contexto:** Next empaqueta páginas y route handlers por separado; un singleton de módulo daba dos copias de los datos demo (un ticket creado por la API no aparecía en el kanban).
- **Decisión:** la instancia del `DemoRepo` vive en `globalThis`. Los e2e corren con 1 worker y cada test reinicia la demo con `POST /api/demo/reiniciar` (solo existe en modo demo).
- **Consecuencias:** en Vercel cada instancia serverless tiene su propia memoria: en el preview los cambios pueden "desaparecer" si el pedido cae en otra instancia o la instancia se recicla. Es esperable en la demo.

## ADR-017 · Kanban accesible
**Fecha:** 2026-10-06 · **Estado:** aceptada

- `@dnd-kit/core` con un **botón asa** por tarjeta ("Mover TCK-0001"), separado del link y del botón "Tomar" (evita elementos interactivos anidados). Con teclado: Espacio agarra, ← / → saltan de columna, Espacio suelta, Escape cancela; anuncios en castellano.
- En mobile las columnas son un carrusel horizontal; el cambio de estado accesible es desde el detalle del ticket.

## ADR-018 · Login con MSAL Node y validación propia del ID token
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Decisión:**
  - Flujo *authorization code* + PKCE (S256) del lado del servidor, autoridad `organizations`, `prompt=select_account`.
  - `state`, `nonce`, `code_verifier` y la URL de retorno viajan en una cookie cifrada de un solo uso (`__Host-sbi_login`, 10 min, clave propia). El diseño pedía guardar los parámetros en el `state`; ponerlos en una cookie atada al navegador es equivalente y no expone la URL en el `state`.
  - MSAL canjea el código usando el token OIDC de Vercel como `client_assertion`. Se crea un cliente por login, así la caché de MSAL nunca mezcla usuarios, y no se guardan tokens de Microsoft.
  - Además de MSAL, el **ID token se valida con jose**: firma RS256 contra las claves de Microsoft, audiencia = app Portal, emisor construido con el `tid` del propio token, nonce, `exp`/`nbf`. La identidad sale solo de ahí.
- **Consecuencias:** el login no depende de que MSAL valide la firma, y la validación tiene tests propios con claves generadas.

## ADR-019 · Qué vive en la sesión y cuánto dura
**Fecha:** 2026-10-06 · **Estado:** aceptada (responde la pregunta abierta 2 del contexto)

- **Decisión:** la sesión guarda la identidad del ID token: `oid`, `tid`, email, nombre, app roles, grupos y si es invitado. Además guarda el cliente elegido y la hora del login.
  - Rol de cliente, áreas y estado del cliente se **recalculan en el servidor** en cada request, con caché por instancia de 120 s (configurable hasta 300 s; 0 en demo). Las denegaciones no se cachean.
  - Roles de BHI y grupos vienen del token. Como la sesión vence a las **8 h sin actividad** (renovación deslizante cada 10 min) y tiene **tope absoluto de 24 h**, una baja en Entra impacta como máximo en ese plazo. Para cortar el acceso de alguien ya mismo, rotar `SESSION_SECRET` invalida todas las sesiones.
- **Alternativa descartada:** consultar `appRoleAssignments` en Graph en cada request; suma un permiso de directorio y latencia para un caso raro.

## ADR-020 · CSRF de doble envío
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Decisión:** `proxy.ts` pone `__Host-sbi_csrf` (aleatoria, legible por JS, `Secure`, `SameSite=Lax`) en cada página si falta. Toda mutación de la API exige `Origin` del portal **y** el header `x-csrf-token` igual a la cookie (comparación en tiempo constante). Los formularios HTML (selector demo, elegir cliente) lo mandan como campo `csrf`. `/api/demo/reiniciar` (solo demo, solo e2e) queda con verificación de `Origin`.
- **Consecuencias:** las llamadas desde el navegador usan siempre `llamarApi`, que agrega el header.

## ADR-021 · Detección de invitados y overage de grupos
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Invitado:** el claim opcional `acct = 1`, **o** un `idp` distinto del emisor (cubre el caso de que falte `acct`). Un invitado en el tenant de BHI recibe 403 aunque tenga un app role asignado. Mientras no se confirme lo de satélites con cuentas B2B (pregunta abierta 1), se mantiene este criterio: falla cerrado.
- **Overage:** si el token no trae los grupos, se consulta Graph `checkMemberGroups` **solo** con los grupos satélite configurados en "Clientes BI". Requiere `GroupMember.Read.All` en la app Datos, que es opcional: sin el permiso, o si Graph falla, la persona queda sin grupos (falla cerrado).

## ADR-022 · Login real también en el preview de la demo
**Fecha:** 2026-10-06 · **Estado:** aceptada

- **Contexto:** hasta la etapa 3 no hay SharePoint, así que producción no funciona. Igual hay que probar el login real.
- **Decisión:** con `DEMO_MODE=true` **y** las variables de Entra cargadas, la bienvenida ofrece el login real y el de persona demo. Las identidades reales se resuelven contra los datos demo, y tanto el tenant ficticio de BHI como el real cuentan como BHI.
- **Consecuencias:** el criterio de la etapa 2 se verifica en el preview (`DEPLOY.md` §3.5). La guarda de producción sigue igual: `DEMO_MODE` nunca en Production.
