# Bitácora

Una entrada al terminar cada tarea: fecha, qué se hizo, decisiones y pendientes. La más nueva arriba.

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
