# Portal de Soporte BI — Contexto del proyecto

> **Fuente de verdad del diseño.** Si algo del código contradice este documento, gana este documento (o se actualiza acá con una decisión en `DECISIONES.md`).
> BHI Consultora Regional · Responsable: Martín Lasserre (mlasserre@bhiconsultora.com.ar)
> Última actualización: 2026-10-06 (cierre de la etapa 2).

## 1. Qué resuelve

Sistema de gestión de reclamos sobre los tableros de Power BI que BHI mantiene para sus clientes.

1. Un usuario del cliente, mirando un tablero de Power BI, hace clic en **"Reportar un problema"** → se abre el portal con el tablero (y la página) precargados.
2. Entra con su **cuenta corporativa de Microsoft** (sin crear usuarios).
3. Carga el reclamo y lo sigue en una línea de tiempo; recibe correo cuando hay respuesta.
4. **Claude** (vía un conector MCP propio, desde Claude Pro de escritorio) clasifica, prioriza, deja una nota interna y un **borrador**. **Nunca** publica ni envía nada.
5. **Soporte de BHI** trabaja los tickets en un **kanban**, revisa/edita el borrador y publica.
6. Todo queda en **SharePoint del tenant de BHI** y alimenta un Power BI de seguimiento.

## 2. Principios no negociables

- **Sin base de datos propia.** Persistencia en SharePoint Online (listas + biblioteca) vía Microsoft Graph. Backend sin estado.
- **Tokens fuera del navegador** (patrón BFF): login y llamadas a Graph del lado del servidor; el navegador solo tiene una cookie de sesión `httpOnly`.
- **Sin secretos de larga vida:** el backend se autentica ante Entra con **federación OIDC de Vercel**. Si algo no lo soporta, certificado; nunca client secrets en el repo.
- **Autorización por recurso en el servidor**, derivada solo de la sesión validada. Nunca del body, query o headers controlados por el cliente.
- **La IA no actúa hacia el cliente.** No existe ninguna herramienta MCP que publique, envíe correo o cambie visibilidad.
- **Mínimo privilegio** en Microsoft 365: `Sites.Selected` sobre un solo sitio, `Mail.Send` acotado a un buzón.
- **Modo demo** solo con bandera explícita y nunca en producción.

## 3. Stack

| Capa | Elección | Estado |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 6 `strict` | ✅ etapa 0 |
| UI | Tailwind CSS v4, shadcn/ui (paquete `radix-ui`), lucide-react; modales con `<dialog>` nativo (sin sonner, ADR-012); kanban con `@dnd-kit/core` | ✅ |
| Formularios / validación | react-hook-form + zod 4 (mismos esquemas en cliente y servidor, `dominio/esquemas.ts`) | ✅ |
| Auth | `@azure/msal-node` (auth code + PKCE) con `clientAssertion` = token OIDC de Vercel; sesión en cookie cifrada con `jose` (JWE `dir` + `A256GCM`); ID token validado con jose (ADR-018) | ✅ |
| Graph | `fetch` propio tipado, caché de token de app, reintentos con backoff ante 429/503 con `Retry-After`, paginación `@odata.nextLink` | ✅ cliente base (`infra/graph`) · uso en etapa 3 |
| MCP | `mcp-handler` o `@modelcontextprotocol/sdk` sobre un route handler, Streamable HTTP | etapa 5 |
| Fechas | date-fns + `@date-fns/tz` (`America/Argentina/Buenos_Aires`) | ✅ |
| Tests | Vitest (unit/integración), Playwright (e2e en modo demo) + `@axe-core/playwright` | ✅ |
| Hosting | Vercel (Hobby para pruebas → Pro antes de clientes). Crons de Vercel | preview etapa 0 |
| CI | GitHub Actions: `bun install --frozen-lockfile`, audit, lint, typecheck, test, build, e2e | ✅ |
| Paquetes | **bun** (`bunfig.toml` con `minimumReleaseAge = 86400`) | ✅ |

Identidad visual: `--main #005278`, `--main-hover #00405e`, `--background #f6f7f2`; títulos **Lexend Deca**, cuerpo **Nunito Sans** (`next/font`); botones píldora; tarjetas `rounded-2xl`; textos claros, sin jerga, en rioplatense. Mobile first y accesible (WCAG 2.1 AA).

### Estructura del código

```
src/
├─ app/            pantallas (App Router) y route handlers (api/)
├─ proxy.ts        CSP con nonce por request + x-url (Next 16 renombró middleware → proxy)
├─ dominio/        catálogos, entidades, DTOs (TicketCliente / TicketSoporte), IDs, SLA — puro, sin I/O
├─ servicios/      casos de uso + autorización (encima del repositorio)
├─ repositorio/    interfaces + sharepoint/ (etapa 3) + demo/ (en memoria, import dinámico)
├─ infra/          env, sesión, csrf, http, logger, contexto de request; luego graph, msal, mailer, notifier
├─ components/     ui/ (shadcn), layout/, tickets/, demo/
└─ lib/            utilidades de presentación
tests/             Vitest · e2e/  Playwright · docs/  memoria del proyecto
```

Reglas: los handlers solo validan, arman el contexto y llaman a `servicios/`. Ningún componente ni handler llama a Graph directamente (solo `SharePointRepo`, `Mailer` y `Notifier`).

## 4. Identidad y tenants

### 4.1 Apps de Entra ID (tenant BHI)

| App | Tipo | Uso | Credencial |
|---|---|---|---|
| **Soporte BI – Portal** | Web, **multi-tenant**, confidencial | Login (`openid profile email`). App roles: **`Soporte`**, **`Admin`**. Claim `groups` limitado a "grupos asignados a la aplicación" | Credencial federada (Vercel OIDC) |
| **Soporte BI – Datos** | Single tenant | Graph app-only: `Sites.Selected` (write, solo sitio "Soporte BI"), `Mail.Send` acotado por RBAC for Applications de Exchange a `NOTIFY_MAILBOX` | Credencial federada (Vercel OIDC) |

El conector MCP de Claude usa la app Portal (mismo login, rol `Soporte` requerido).

### 4.2 Tipos de cliente

1. **Cliente con tenant propio** (ej.: ENA): se identifica por `tid`.
2. **Cliente satélite**: sus usuarios son **cuentas miembro dentro del tenant de BHI**. Se identifica por pertenencia a un **grupo de seguridad de Entra** del tenant de BHI (uno por cliente satélite, asignado a la app Portal). El grupo llega en el claim `groups` del ID token.
   - Si un usuario pertenece a más de un grupo satélite: selector de cliente tras el login (`/elegir-cliente`; la elección se guarda en la sesión y se revalida contra los grupos en cada request). ✅ etapa 0 en demo.
   - Si el token trae overage de grupos (`_claim_names`), se resuelve con Graph `checkMemberGroups` solo con los grupos satélite configurados (`GroupMember.Read.All` en la app Datos, opcional; sin él falla cerrado). ✅ ADR-021
3. **BHI como cliente de prueba** (piloto interno): BHI se da de alta en "Clientes BI" con tipo satélite y un grupo "Piloto Soporte BI".

> ⚠️ **Pendiente de confirmar con Martín antes de la etapa 2:** si algún satélite usa cuentas invitadas (B2B) en lugar de miembros. Cambia la autoridad de login y la validación (hoy un invitado del tenant de BHI recibe 403).

### 4.3 Resolución de rol (en cada request, desde la sesión) — `src/servicios/acceso.ts`

```
si tid == BHI_TENANT_ID:
  si usuario es invitado (acct == 1 / userType Guest) → 403 sin_permiso
  si tiene app role Admin   → admin (incluye todo lo de soporte)
  si tiene app role Soporte → soporte
  si pertenece a grupo(s) de cliente satélite activo → rol de cliente en ese cliente
  si no → 403 sin_permiso
si no:
  cliente = Clientes BI donde TenantId == tid y Activo
  si no hay → registrar en "Solicitudes de acceso" y 403 tenant_no_habilitado
rol de cliente:
  email ∈ ReferentesGenerales del cliente → referente
  email ∈ Líderes de alguna Área activa del cliente → líder (de esas áreas)
  si no → usuario
```

Emails en minúsculas. La sesión guarda la identidad del token (`oid`, `tid`, `email`, `nombre`, app roles, grupos, invitado), `clienteElegidoId` y la hora del login; **rol y áreas se recalculan en el servidor** con caché de 120 s (ADR-019) para que las bajas impacten rápido. Los app roles y grupos solo se consideran dentro del tenant de BHI. Invitado = `acct = 1` o `idp` externo (ADR-021).

### 4.4 Consentimiento

Si el login falla por falta de consentimiento (`AADSTS65001` y similares), pantalla `/consentimiento` que explica el paso y ofrece copiar el link de admin consent: `https://login.microsoftonline.com/organizations/adminconsent?client_id=<PORTAL_CLIENT_ID>&redirect_uri=<APP_URL>/consentimiento`. ✅ (AADSTS65001, 65004, 90094, 90008, 650052, 700016 → `/consentimiento`)

## 5. Roles y permisos

| Rol | Ve | Comenta | Otras acciones |
|---|---|---|---|
| Usuario | Sus tickets | Sus tickets | Crear, marcar "Se resolvió", reabrir (≤ 15 días) |
| Líder de área | Sus tickets + tickets de los tableros de sus áreas | Solo sus tickets | Igual que usuario |
| Referente general | Todos los tickets de su cliente | Solo sus tickets | Igual que usuario |
| Soporte | Todo | Todo + notas internas | Tomar/asignar, cambiar estado y prioridad, publicar/descartar borradores |
| Admin | Todo | Todo | Lo de soporte + clientes, áreas, tableros, solicitudes, feriados |

Filtros (siempre aplicados por `servicios/tickets.ts → filtroPorRol`):

| Rol | Condición |
|---|---|
| Usuario | `ClienteId = sesión.clienteId AND AutorOid = oid` |
| Líder | `ClienteId = sesión.clienteId AND (AutorOid = oid OR TableroId ∈ tablerosDe(áreasQueLidera))` |
| Referente | `ClienteId = sesión.clienteId` |
| Soporte / Admin | — |

- Ticket fuera de alcance → **404** (no 403).
- `nota_interna`, `borrador_respuesta`, `Visible = false` y los campos `Categoria`, `ResumenIA`, `ProcesadoIA`, `AsignadoA` **no se serializan** para roles de cliente. DTOs distintos (`TicketCliente` vs `TicketSoporte`, en `src/dominio/dto.ts`).
- Al comentar se carga el ticket y se aplica la misma regla de lectura + la de "solo propios".
- Las áreas de un ticket se resuelven en el momento a partir de `TableroId` (un tablero puede estar en varias áreas); no se copian al ticket.
- La `vista` (`mios` · `area:<id>` · `org`) es una preferencia que se recorta al rol: un usuario que pide `org` recibe solo los suyos; un líder que pide un área que no lidera recibe solo los suyos.

## 6. Modelo de datos (SharePoint, sitio "Soporte BI")

| Lista | Columnas (índices en **negrita**) |
|---|---|
| Clientes BI | Cliente, Tipo (`tenant` \| `satelite`), **TenantId**, GrupoId (satélite), Dominio, Activo, ReferentesGenerales (emails `;`), NotasContexto |
| Áreas BI | **ClienteId** (lookup), Área, Líderes (emails `;`), Activo |
| Tableros BI | **TableroId** (slug estable, ej. `ventas-dtc`), Nombre, **ClienteId**, Áreas (lookup multivalor → Áreas BI), Páginas (opcional), Activo |
| Tickets BI | **ClienteId**, **TableroId**, Página, Contexto (JSON con filtros del botón, opcional), Tipo, Descripción, Urgencia, **Estado**, Prioridad, Categoría, ResumenIA, **ProcesadoIA**, **AutorOid**, AutorNombre, AutorEmail, **AsignadoA** (email), FechaAlta, UltimaActualizacion, FechaResuelto, VenceSLA |
| Historial Tickets BI | **TicketItemId**, Tipo (`estado` \| `comentario` \| `nota_interna` \| `borrador_respuesta` \| `asignacion` \| `prioridad`), Autor, AutorEmail, AutorEsIA, Fecha, Texto, Visible, EstadoBorrador (`pendiente` \| `publicado` \| `descartado`), Adjuntos (JSON) |
| Solicitudes de acceso | TenantId, Dominio, Email, Nombre, Fecha, Estado (`pendiente` \| `aprobada` \| `rechazada`) |
| Feriados BI | Fecha, Descripción |
| Biblioteca "Adjuntos Tickets" | Carpeta por ticket; archivos con nombre UUID; metadato con nombre original |

- **ID visible**: `TCK-` + `padStart(itemId, 4, "0")`, **derivado** del ID de SharePoint (no se guarda). Historial referencia `TicketItemId` numérico. (`src/dominio/ticket-id.ts`)
- Escapar `'` → `''` en todo `$filter` y usar allow-list de campos ordenables/filtrables. Header `Prefer: HonorNonIndexedQueriesWarningMayFailRandomly` prohibido: indexar.
- Script idempotente `scripts/provision.ts` (dry run por defecto, `--apply` crea/actualiza listas, columnas e índices) ejecutable desde GitHub Actions con credencial federada OIDC de GitHub. (etapa 3)

### Dominios (`src/dominio/catalogos.ts`)

| Campo | Valores |
|---|---|
| Tipo | Dato incorrecto · El tablero no se actualiza · Acceso / permisos · Error visual o de carga · Pedido de mejora · Consulta · Otro |
| Urgencia | Baja · Media · Alta · Crítica |
| Estado | Nuevo → En análisis → Esperando al cliente → Resuelto → Cerrado (Resuelto → En análisis si el cliente reabre) |
| Prioridad | P1 mismo día hábil · P2 24 h hábiles · P3 72 h hábiles · P4 próxima planificación |
| Prioridad inicial | Crítica→P1, Alta→P2, Media→P3, Baja→P4 (luego la ajusta Claude o soporte) |
| Categoría (Claude/soporte) | mismos valores que Tipo |

**SLA**: horario hábil lun–vie 9–18 h `America/Argentina/Buenos_Aires`, excluyendo "Feriados BI". `VenceSLA` se recalcula al cambiar la prioridad. Semáforo: verde > 50 % restante, amarillo ≤ 50 %, rojo vencido. Función pura con tests (`dominio/sla.ts`, ADR-013: se recalcula desde el alta). ✅

## 7. Entrada desde Power BI

URL: `/nuevo?tablero=<TableroId>&pagina=<slug>&ctx=<json-url-encoded opcional>`.

- `tablero` es una **sugerencia**: el servidor verifica que pertenezca al cliente de la sesión; si no, se ignora y se muestra un selector con los tableros del cliente.
- Los parámetros sobreviven al login (`volver` en etapa 0/demo; `state` del flujo OAuth validado en etapa 2). Solo se aceptan rutas internas (`rutaInternaSegura`).
- `ctx` se valida con zod (objeto plano, claves y valores string cortos, tamaño máximo) y se muestra a soporte/Claude como dato.
- La pantalla de admin genera la medida DAX del botón para cada tablero/página.

## 8. API (route handlers, todos con sesión salvo auth)

| Método | Ruta | Rol | Notas |
|---|---|---|---|
| GET | `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout` | — | PKCE, `state` y `nonce` verificados. En demo, login crea sesión de persona demo |
| GET | `/api/me` | todos | `{ nombre, email, cliente, rol, areas[] }` ✅ |
| GET | `/api/tableros` | cliente | Tableros del cliente de la sesión |
| GET | `/api/tickets?vista=mios\|area:<id>\|org&estado=&q=&cursor=` | todos | `vista` es preferencia; se recorta al rol |
| POST | `/api/tickets` | cliente | multipart; devuelve `{ ticketId }` |
| GET | `/api/tickets/:id` | según alcance | DTO según rol; incluye adjuntos `{ id, nombre, tipo, tamaño }` |
| POST | `/api/tickets/:id/comentarios` | autor / soporte | Con adjuntos |
| POST | `/api/tickets/:id/resolver` · `/reabrir` | autor | Reabrir solo ≤ 15 días desde `FechaResuelto` |
| GET | `/api/adjuntos/:id` | según alcance del ticket | Proxy autorizado, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` |
| PATCH | `/api/tickets/:id` | soporte | `{ estado?, prioridad?, asignadoA? }` |
| POST | `/api/tickets/:id/tomar` | soporte | Se asigna a sí mismo |
| POST | `/api/tickets/:id/notas` | soporte | Nota interna |
| POST | `/api/tickets/:id/borradores/:bid/publicar` `{ texto }` | soporte | Verifica que `:bid` ∈ `:id`, tipo borrador, `pendiente` |
| DELETE | `/api/tickets/:id/borradores/:bid` | soporte | Marca `descartado` |
| CRUD | `/api/admin/clientes`, `/areas`, `/tableros`, `/feriados`, `/solicitudes` | admin | |
| GET | `/api/cron/cerrar-resueltos` | Vercel Cron | `Authorization: Bearer ${CRON_SECRET}`; cierra Resueltos > 15 días |
| * | `/api/mcp` | soporte (OAuth) | Ver §11 |
| POST | `/api/sesion/cliente` | satélite multi-cliente | Guarda el cliente elegido (revalidado contra grupos) ✅ |
| POST | `/api/demo/persona` | solo modo demo | Cambia la persona demo (404 fuera de demo) ✅ |

Errores: `{ error: string, code?: string, requestId }`; códigos `401`, `403 { code: "tenant_no_habilitado" | "sin_permiso" }`, `404`, `409`, `413`, `422`, `429`. Nunca exponer detalles de Graph ni stacks (`src/infra/http.ts`).

## 9. Seguridad transversal

| Control | Implementación | Estado |
|---|---|---|
| Sesión | Cookie `__Host-sbi_sesion`, `httpOnly`, `Secure`, `SameSite=Lax`, JWE; expira a las 8 h sin actividad (renovación deslizante), tope 24 h; logout borra la cookie | ✅ |
| CSRF | Mutaciones solo `POST/PATCH/DELETE` con verificación de `Origin` + token de doble envío | ✅ (ADR-020) |
| Validación | zod en cada handler; longitudes máximas; enums | ✅ |
| Adjuntos | Máx. 3 por mensaje, 4 MB c/u, 10 MB por request. PNG, JPEG, WebP, PDF, XLSX, CSV. Verificación por **magic bytes** (CSV: UTF-8 válido sin nulos; XLSX: ZIP con `[Content_Types].xml` y **sin** `vbaProject.bin`). Rechazar SVG, XLSM, ejecutables. Nombre UUID | ✅ validación · ⚠️ límite de ~4,5 MB por request en Vercel (§18) |
| Rate limit | Por `oid` en creación de tickets y comentarios (ventana deslizante; documentar la limitación sin estado; Vercel Firewall cuando el plan lo permita) | etapa 6 |
| Headers | CSP con nonce (`default-src 'self'`; `connect-src 'self'`; `frame-ancestors 'none'`; `form-action` con `login.microsoftonline.com`), HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | ✅ |
| Logs | Sin tokens, sin contenido de tickets, sin emails completos; `requestId` en cada log | ✅ base (`src/infra/logger.ts`) |
| IA | Contenido de clientes delimitado como dato no confiable en MCP; sin herramientas de acción externa | etapa 5 |
| Dependencias | `bun audit` en CI; acciones fijadas por SHA; `permissions:` mínimos | ✅ |
| Modo demo | Solo si `DEMO_MODE=true`; el build **falla** si `DEMO_MODE=true` y `VERCEL_ENV=production` (`next.config.ts`) y también en runtime (`env.ts`). Datos demo por import dinámico | ✅ |

## 10. Pantallas

Cliente:
1. **/bienvenida** ✅: "Iniciar sesión con Microsoft" (redirige si ya hay sesión).
2. **/nuevo** ✅: tablero precargado (chip) o selector; página; tipo (chips); descripción (mín. 20, ayuda contextual); urgencia (segmentado con explicación); adjuntos (arrastrar, pegar Ctrl+V, vista previa); **autoguardado local del borrador**; confirmación con número de ticket.
3. **/** "Mis reclamos" ✅: selector `Míos / <cada área que lidera> / De mi organización` según rol; tarjetas resumen (abiertos, esperando tu respuesta, resueltos del mes) que **no** cambian con el filtro; búsqueda; filtros por estado; tabla en escritorio, tarjetas en mobile.
4. **/tickets/[id]** ✅: datos, línea de tiempo tipo chat (sin internos), responder con adjuntos, "Se resolvió", "Reabrir".
5. **/no-habilitado** ✅, **/elegir-cliente** ✅, **/consentimiento** ✅, 404 ✅ y error ✅ amigables.

Soporte:
6. **/soporte** ✅: **kanban** por estado (Nuevo, En análisis, Esperando al cliente, Resuelto) con tarjetas: ID, cliente, tablero, prioridad, semáforo SLA, asignado, ícono de borrador pendiente. Filtros: cliente, prioridad, "míos", "sin asignar", "con borrador pendiente". Cambiar estado arrastrando (con teclado accesible) o desde el detalle. Botón "Tomar".
7. **/soporte/tickets/[id]** ✅: historial con internos; bloque **"Claude · IA · Interno"** visualmente distinto; borrador editable con "Publicar" (confirmación "Esto lo va a ver el cliente"), "Descartar"; nota interna; estado, prioridad, asignado; contexto del botón de Power BI.

Admin:
8. **/admin** ✅: clientes (alta por dominio → TenantId vía `/.well-known/openid-configuration`; satélite → GrupoId), áreas y líderes, tableros (multi-área) con generador de medida DAX, solicitudes de acceso, feriados, link de consentimiento copiable.

En modo demo: selector flotante de persona ✅ (11 personas: usuario, otra usuaria, líder, referente, usuaria de otro cliente, satélite, satélite multi-cliente, soporte, admin, invitado B2B, tenant no habilitado).

## 11. Servidor MCP "Soporte BI" (`/api/mcp`)

- Lo usa **Claude Pro (app de escritorio)** como **conector personalizado**. Solo usuarios de BHI con rol `Soporte` o `Admin`.
- **OAuth:** Entra ID no soporta registro dinámico de clientes. A investigar y decidir en la etapa 5 (en `DECISIONES.md`): (a) Client ID/Secret de la app Portal en la UI de conectores de Claude, o (b) `/api/mcp` como servidor de autorización fachada (metadata RFC 8414/9728, DCR propio, `authorize` que delega en Entra, tokens propios de corta vida firmados con audiencia del MCP). Validar rol en cada llamada.

| Tipo | Herramienta | Efecto |
|---|---|---|
| Lectura | `listar_tickets(estado?, cliente?, procesadoIA?, limite?)` | |
| Lectura | `obtener_ticket(ticketId)` | Ticket + historial + adjuntos de imagen como `image`, PDF/CSV como texto extraído con límite |
| Lectura | `buscar_tickets_similares(texto, cliente?)` | |
| Lectura | `obtener_cliente(cliente)` | NotasContexto, áreas, tableros |
| Escritura | `clasificar_ticket(ticketId, categoria, prioridad, resumenIA)` | `ProcesadoIA = true`, recalcula SLA |
| Escritura | `agregar_nota_interna(ticketId, texto)` | `Visible = false` |
| Escritura | `crear_borrador_respuesta(ticketId, texto)` | `Visible = false`, `EstadoBorrador = pendiente` |
| Escritura | `cambiar_estado(ticketId, estado)` | Solo Nuevo ↔ En análisis |

Invariantes: todo lo que escribe queda con `Autor = "Claude"`, `AutorEsIA = true`; no hay herramientas para publicar, enviar correo, cambiar visibilidad, asignar ni cerrar. Las respuestas envuelven el texto del cliente en delimitadores con advertencia de dato no confiable. Prompt MCP `procesar_tickets_nuevos` con instrucciones de triage (criterios, tono rioplatense, nunca prometer plazos).

Triage automático por API de Anthropic preparado y **desactivado**: si existe `ANTHROPIC_API_KEY`, al crear un ticket se ejecuta en segundo plano (`waitUntil`) el mismo flujo con las mismas herramientas internas.

## 12. Notificaciones

- **Correo** (Graph `sendMail` desde `NOTIFY_MAILBOX`, hoy `mlasserre@bhiconsultora.com.ar`): al cliente al crear el ticket y cuando soporte publica una respuesta. Plantillas HTML simples con `[TCK-0042]` en el asunto y link al ticket. Sin contenido interno.
- **Teams**: aviso al canal de soporte por ticket nuevo (destacado si P1) vía webhook de Workflows (`TEAMS_WEBHOOK_URL`); si no existe, se omite sin error.
- Líderes y referentes **no** reciben avisos.

## 13. Modo demo y arquitectura interna

- Interfaz `Repositorio` (`src/repositorio/tipos.ts`) con `SharePointRepo` (etapa 3) y `DemoRepo` (en memoria, `example.com`: 2 clientes con tenant, 1 satélite + piloto BHI, áreas con tablero compartido, 15 tickets en todos los estados, borradores y notas de "Claude").
- Las personas demo se modelan como **identidades del ID token**; así la misma `resolverAcceso` corre en demo y en producción.
- **La autorización vive encima del repositorio** (`servicios/`): los tests de permisos cubren ambas implementaciones.

## 14. Testing (bloqueante en CI)

- Matriz de autorización (Vitest) rol × operación × recurso propio/ajeno/otra área/tablero compartido/otro cliente/satélite. ✅
- SLA ✅, adjuntos ✅, DAX ✅; escapado OData y herramientas MCP en sus etapas.
- Playwright en modo demo: recorridos de usuario, líder, referente, soporte y admin, escritorio + mobile 375 px, axe sin violaciones serias, Escape cierra modales. ✅

## 15. Variables de entorno

Públicas: ninguna. Servidor: `APP_URL`, `SESSION_SECRET`, `BHI_TENANT_ID`, `PORTAL_CLIENT_ID`, `DATA_CLIENT_ID`, `SP_SITE_ID`, `NOTIFY_MAILBOX`, `TEAMS_WEBHOOK_URL` (opcional), `CRON_SECRET`, `ANTHROPIC_API_KEY` (opcional), `DEMO_MODE` (solo desarrollo/preview). Ver `.env.example` y `DEPLOY.md`.

En modo demo solo se usa `DEMO_MODE`; `SESSION_SECRET` es opcional (si falta se usa un secreto fijo de demo).

## 16. Etapas

| Etapa | Entrega | Hecho cuando | Estado |
|---|---|---|---|
| 0. Base | Limpieza de Lovable, Next.js + bun, identidad visual, layout, modo demo, CI, `docs/` | CI verde; deploy en Vercel preview en modo demo | ✅ aprobada 2026-10-06 (preview desde la rama `demo`) |
| 1. UI completa en demo | Todas las pantallas de §10 contra `DemoRepo`, kanban, admin | Recorridos de Playwright de los 5 roles | ✅ aprobada 2026-10-06 |
| 2. Auth real | MSAL Node + federación Vercel, sesión, rol (tenant, satélite, BHI), consentimiento, solicitudes | Matriz de autorización verde; guía de Entra en `DEPLOY.md` | ✅ código y guía · falta probar con las apps reales (§3.5) |
| 3. SharePoint | `SharePointRepo`, adjuntos, `provision.ts` + workflow | Contrato del repo contra mock de Graph; dry run documentado | |
| 4. Notificaciones y cron | Correo, Teams, cierre automático, SLA | Tests de plantillas y del cron | |
| 5. MCP | Servidor, OAuth, herramientas, prompt de triage; triage por API desactivado | Conector agregado en Claude Pro procesando un ticket de prueba | |
| 6. Endurecimiento | Headers, rate limit, revisión de seguridad, `bun audit` | Checklist de §9 completo | |

## 17. Fuera de alcance (por ahora)

Multicanal (WhatsApp/Copilot Studio), Dataverse, otros idiomas, migración de tickets históricos, avisos a líderes/referentes, pestaña de Teams (dejar la app compatible para sumarla luego).

## 18. Preguntas abiertas

1. ¿Algún cliente satélite usa cuentas invitadas (B2B)? (antes de la etapa 2)
2. ~~App roles y grupos en la sesión~~ → decidido en ADR-019 (del token; impacto máximo 8 h sin actividad / 24 h; rotar `SESSION_SECRET` para cortar ya).
3. **Tamaño de adjuntos vs. Vercel:** una función de Vercel acepta como máximo ~4,5 MB por request y el diseño permite 10 MB por mensaje. Propuesta: subir cada adjunto en su propio request (≤ 4 MB) antes de mandar el mensaje. A decidir antes de la etapa 3.
4. **SLA:** ¿"24 h / 72 h hábiles" son horas hábiles literales (implementado) o 1 / 3 días hábiles? (ADR-013)
