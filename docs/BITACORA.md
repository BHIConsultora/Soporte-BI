# Bitácora

Una entrada al terminar cada tarea: fecha, qué se hizo, decisiones y pendientes. La más nueva arriba.

---

## 2026-10-06 · Etapa 2 — Login real con Microsoft

**Qué se hizo**

- **Login:**
  - `/api/auth/login` arma el *authorization code* + PKCE con MSAL Node (autoridad `organizations`), con `state`/`nonce`/`code_verifier` y la URL de retorno en una cookie cifrada de un solo uso.
  - `/api/auth/callback` valida el `state`, canjea el código con la credencial federada de Vercel (`@vercel/oidc` como `client_assertion`) y valida el ID token con jose (firma, emisor por `tid`, audiencia, nonce). Después resuelve el overage de grupos si hace falta, crea la sesión y registra la solicitud de acceso si la organización no está habilitada.
  - Los errores de Entra se traducen: falta de consentimiento → `/consentimiento`; usuario no asignado → "no habilitado"; cancelación → aviso en la bienvenida.
- **Sesión:** JWE con claves derivadas por propósito, vencimiento a las 8 h sin actividad con renovación deslizante en `proxy.ts`, tope absoluto de 24 h y caché del acceso por instancia (120 s, 0 en demo).
- **CSRF:** token de doble envío en todas las mutaciones, además del `Origin`.
- **Graph:** cliente mínimo (token de app con MSAL + federación, reintentos con `Retry-After`, paginación); por ahora solo lo usa el overage de grupos.
- **Modo demo:** si en el preview se cargan las variables de Entra, conviven el login real y las personas demo.
- **Entorno:** producción exige `APP_URL`, `SESSION_SECRET`, `BHI_TENANT_ID` y `PORTAL_CLIENT_ID`. El resto se valida donde se usa.
- **Docs:** guía completa de Entra ID y Vercel en `DEPLOY.md` §3 (apps, redirect URIs, claims, app roles, asignación, credenciales federadas, variables y cómo probar).
- **Tests:**
  - 242 de Vitest: los de antes más ID token (firma, audiencia, emisor, nonce, alg none, invitados, overage), transacción PKCE, errores de Entra, CSRF, caché de acceso, sesión deslizante y tope, entorno, cliente de Graph (reintentos, `Retry-After`, sin filtrar cuerpos) y overage.
  - 72 de Playwright: suma CSRF, atributos de cookies y la ruta de error del login.
  - La matriz de autorización sigue verde.

**Decisiones:** ADR-018 a ADR-022.

**No verificado (requiere las apps de Entra):** el login real de punta a punta (canje con la credencial federada, claims reales y consentimiento de otra organización). Está cubierto por partes con tests, pero falta probarlo con las apps reales siguiendo `DEPLOY.md` §3.5.

**Pendientes**

- Martín: crear las apps y credenciales (§3), cargar las variables en Preview y probar la tabla de §3.5.
- Sigue abierta la pregunta de satélites con cuentas B2B (hoy: invitado = sin acceso).
- Etapa 3: `SharePointRepo`, adjuntos en la biblioteca (subida de a un archivo por el límite de Vercel), `provision.ts`.

---

## 2026-10-06 · Etapa 1 — UI completa en modo demo

**Qué se hizo**

- **Dominio:** SLA en horario hábil con feriados y semáforo (`dominio/sla.ts`), validación de adjuntos por magic bytes (`dominio/adjuntos.ts`), esquemas zod compartidos cliente/servidor (`dominio/esquemas.ts`), generador de la medida DAX (`dominio/dax.ts`), DTOs de detalle (`TicketDetalleCliente`, `TicketDetalleSoporte`, `TicketKanban`).
- **Repositorio:** interfaz completa con escrituras (tickets, historial, adjuntos, clientes, áreas, tableros, feriados, solicitudes) y `DemoRepo` en memoria compartido en `globalThis`.
- **Servicios (autorización encima del repo):** `autorizacion.ts` (filtro por rol, `puedeLeer`, 404 fuera de alcance, 403 si no es propio), tickets (listar, resumen, detalle, alta, comentar, resolver, reabrir), soporte (estado/prioridad/asignación, tomar, nota interna, publicar/descartar borrador), descarga autorizada de adjuntos, admin (clientes, áreas, tableros, feriados, solicitudes) y registro de solicitudes de acceso al iniciar sesión.
- **API:** todos los endpoints de §8 salvo cron y MCP, con un wrapper común (`infra/api.ts`): verificación de `Origin` en mutaciones, sesión + acceso recalculado, zod, límites de tamaño y errores `{ error, code, requestId }`.
- **Pantallas:**
  - `/nuevo`: tablero precargado o selector, página, chips de tipo con ayuda contextual, urgencia segmentada, adjuntos (arrastrar, pegar, vista previa), autoguardado local y confirmación.
  - `/`: resumen, vistas por rol, búsqueda, filtro por estado, tabla en escritorio y tarjetas en mobile, paginado.
  - `/tickets/[id]`: conversación tipo chat, responder con adjuntos, "Se resolvió" y "Reabrir".
  - `/soporte`: kanban con filtros, "Tomar", semáforo de SLA, aviso de borrador y arrastre con teclado.
  - `/soporte/tickets/[id]`: historial completo, bloque "Claude · IA · Interno", borrador editable con confirmación, nota interna, estado/prioridad/asignación y contexto de Power BI.
  - `/admin`: clientes (con búsqueda de TenantId por dominio), áreas y líderes, tableros multi-área con generador DAX, solicitudes, feriados y link de consentimiento.
  - `/consentimiento` y navegación por rol en el header.
- **Tests:** 192 de Vitest (matriz de autorización rol × operación × recurso propio/ajeno/otra área/tablero compartido/otro cliente/satélite; internos nunca en el DTO de cliente; SLA; adjuntos; DAX; esquemas; flujos de soporte y admin) y 64 de Playwright (32 escenarios × escritorio y mobile 375 px, con axe sin violaciones serias y Escape cerrando modales).
- Verificado a mano en el navegador: alta desde link con `?tablero=` y `ctx`, kanban con teclado, publicar borrador con confirmación.

**Bugs encontrados y corregidos en el camino:** el vencimiento P1 salía con offset en vez de UTC; el repo demo tenía dos copias (páginas vs. API); en mobile el kanban generaba scroll horizontal de página por textos `sr-only` posicionados fuera del contenedor.

**Decisiones:** ADR-012 a ADR-017 (sin sonner ni Radix Dialog por la CSP, reglas de SLA, ciclo de vida, adjuntos, repo demo compartido, kanban accesible).

**Pendientes y preguntas para Martín**

- **Límite de Vercel:** una función acepta como máximo ~4,5 MB por request y el diseño pide hasta 10 MB por mensaje. Propuesta para la etapa 3: subir cada adjunto en un request propio (≤ 4 MB) antes de enviar el mensaje. Hasta entonces, en el preview un envío de más de ~4,5 MB falla.
- **SLA:** confirmar si "24 h / 72 h hábiles" son horas literales (implementado) o 1 / 3 días hábiles (ADR-013).
- Sigue pendiente: ¿algún satélite usa cuentas invitadas B2B? (antes de la etapa 2).
- Etapa 2: login real (MSAL + federación Vercel), token CSRF de doble envío, renovación deslizante de la sesión, caché ≤ 5 min del acceso.

---

## 2026-10-06 · Etapa 0 aprobada

**Qué se hizo:** Martín verificó el deploy de Preview de la rama `demo` en Vercel funcionando en modo demo y dio por **aprobada la etapa 0**. Se cumple el criterio "CI verde; deploy en Vercel preview funcionando en modo demo".

**Pendientes:** arranca la etapa 1 (todas las pantallas contra `DemoRepo`).

---

## 2026-10-06 · Cambio a la rama `demo`

**Qué se hizo:** se creó la rama `demo` desde el cierre de la etapa 0 y desde ahora se trabaja ahí. El CI también corre en `demo`. Se actualizaron `AGENTS.md`, `DEPLOY.md` y `DECISIONES.md`.

**Decisiones:** ADR-011 (reemplaza a ADR-010): en Vercel no está disponible cambiar la *Production Branch*, así que `demo` se despliega como Preview con `DEMO_MODE=true` y `main` queda como producción, congelada hasta la etapa 2.

**Pendientes:** verificar el preview de `demo` en Vercel con `DEMO_MODE=true` cargada para Preview.

---

## 2026-10-06 · Etapa 0 — Base

**Qué se hizo**

- Se eliminó el código heredado de Lovable (TanStack Start, `.lovable/`, `@lovable.dev/*`, `bun.lock` con registry privado). Se conservaron `RESUMEN-TECNICO.md` (antecedente) y `AGENTS.md` (reescrito).
- Proyecto nuevo en Next.js 16.3 + React 19.3 + TypeScript 6 strict + Tailwind 4, con bun 1.4.2 (`bunfig.toml` con `minimumReleaseAge = 86400`).
- Identidad visual (colores, Lexend Deca / Nunito Sans con `next/font`, botones píldora, tarjetas `rounded-2xl`), layout con header/footer, link "saltar al contenido".
- Dominio: catálogos, entidades, DTOs `TicketCliente`/`TicketSoporte`, ID visible `TCK-0042`.
- Repositorio: interfaz `Repositorio` + `DemoRepo` en memoria con 4 clientes (2 con tenant, 1 satélite, piloto BHI), 5 áreas (una con tablero compartido), 8 tableros, 15 tickets en todos los estados, historial con notas y borradores de "Claude".
- Servicios: `resolverAcceso` (§4.3 completo: invitados, app roles solo en BHI, satélites por grupo, selector multi-cliente, referente/líder/usuario) y `listarTickets` con `filtroPorRol` (§5) y DTO según rol.
- Infra: `env` validado con zod, guardia de modo demo (build + runtime), sesión JWE en cookie `__Host-`, verificación de `Origin`, `rutaInternaSegura` (anti open redirect), errores `{ error, code, requestId }`, logger estructurado.
- Seguridad: CSP con nonce por request en `src/proxy.ts`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`; `default-src 'none'` en la API.
- Pantallas: `/bienvenida`, `/` (Mis reclamos, base con vistas por rol), `/no-habilitado`, `/elegir-cliente`, 404 y error. Selector flotante de persona demo (formulario HTML, funciona sin JS).
- API: `/api/auth/login|logout|callback` (login real pendiente → 503), `/api/me`, `/api/sesion/cliente`, `/api/demo/persona`.
- Tests: 54 de Vitest (acceso, listado por rol, DTOs, sesión, CSP, CSRF/redirect, guardia demo, IDs) y 20 de Playwright (10 escenarios × escritorio y mobile 375 px, con axe sin violaciones serias).
- CI en GitHub Actions con acciones fijadas por SHA, `permissions: contents: read`, `bun audit`, lint, tipos, tests, build y e2e.
- `vercel.json`, `.env.example` y documentación (`CONTEXTO-PROYECTO`, `DECISIONES`, `DEPLOY`, esta bitácora).

**Decisiones** (detalle en `DECISIONES.md`): ADR-001 a ADR-010. Las más relevantes: sesión con `jose`, TS 6 y ESLint 9 por compatibilidad, CSP con `style-src-attr 'unsafe-inline'`, guardia demo en `next.config.ts`, excepción puntual de `bun audit` para `braces` (solo dev), rama de producción separada en Vercel hasta tener auth real.

**Pendientes**

- Conectar el repo a Vercel y verificar el preview en modo demo (paso manual, `DEPLOY.md` §1).
- Confirmar con Martín si algún satélite usa cuentas invitadas B2B (antes de la etapa 2).
- Etapa 1: `/nuevo`, detalle de ticket, resúmenes y filtros de "Mis reclamos", kanban de soporte, detalle de soporte, admin, toasts (sonner con nonce).
- Etapa 2: registrar solicitud de acceso al rechazar `tenant_no_habilitado`; token CSRF de doble envío; renovación deslizante de la sesión; caché ≤ 5 min de `resolverAcceso`.
