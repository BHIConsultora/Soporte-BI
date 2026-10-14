# Bitácora

Una entrada al terminar cada tarea: fecha, qué se hizo, decisiones y pendientes. La más nueva arriba.

---

## 2026-10-14 · Migración a Lovable (Vite + Supabase)

**Qué se hizo**

- Se reemplazó Next.js por Vite 8 + React Router 8 (SPA), sin cambios visuales. Se comparó con Playwright pantalla por pantalla (escritorio y mobile, 11 escenas) contra la versión anterior: mismas dimensiones; solo difieren el indicador de desarrollo de Next y píxeles sueltos de antialiasing.
- Modelo de datos en `supabase/migrations/20261014000000_modelo_inicial.sql`: tablas alineadas con `src/dominio/`, RLS en todas, `acceso_actual()` con la regla §4.3, funciones `crear_ticket`, `elegir_cliente`, `olvidar_cliente_elegido` y `registrar_solicitud_acceso`, y bucket privado `adjuntos`.
- `src/backend/` (interfaz `Backend` + implementaciones Supabase y demo), `src/repositorio/supabase/` y `src/integrations/supabase/` (cliente y tipos con la convención de Lovable).
- Se eliminaron los route handlers, la sesión JWE, `proxy.ts`, `next.config.ts`, `vercel.json` y las dependencias de Next, `jose` y `server-only`.
- Tests: 84 de Vitest (34 sobre la migración en PGlite) y 20 de Playwright contra el build de producción.

**Decisiones:** ADR-011 a ADR-014.

**Pendientes**

- Conectar Lovable Cloud, aplicar la migración y configurar el proveedor Azure (`DEPLOY.md`).
- Cargar `configuracion`, `personal_bhi`, clientes, áreas, tableros y `cliente_miembro` reales.
- Etapa 1 sobre Supabase: alta de reclamo (`crear_ticket` ya existe), detalle, comentarios del cliente (falta la función), subida de adjuntos (falta la política de `storage`) y kanban de soporte.
- Etapas 4 y 5 (correo, Teams, MCP, cron de cierre) como Edge Functions.
- El texto del selector demo todavía dice "Nada de esto llega a SharePoint" (no se tocó para no cambiar la UI).

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
