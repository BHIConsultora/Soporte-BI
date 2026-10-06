# Deploy y configuración

Pasos manuales para el administrador (Martín). El equipo de desarrollo no tiene credenciales de Microsoft 365 ni de Vercel: todo lo que requiere secretos o permisos de admin está acá.

Estado por etapa: ✅ listo para hacer · 🕒 se completa en una etapa posterior.

---

## 1. Vercel ✅ (etapa 0: preview en modo demo)

### 1.1 Crear el proyecto

1. En Vercel → **Add New… → Project** → importar `BHIConsultora/Soporte-BI` (autorizar la GitHub App de Vercel para la organización si lo pide).
2. Framework: **Next.js** (se detecta solo). Install y build ya están en `vercel.json`:
   - Install: `bun install --frozen-lockfile`
   - Build: `bun run build`
3. Root directory: la raíz del repo.
4. **Antes del primer deploy**, en *Settings → Environment Variables*, cargar para el entorno **Preview** (no para Production):

   | Variable | Valor | Entorno |
   |---|---|---|
   | `DEMO_MODE` | `true` | **Solo Preview** |
   | `SESSION_SECRET` | 64 caracteres aleatorios (opcional en demo) | Preview |

   > ⚠️ Nunca cargar `DEMO_MODE` en Production: el build falla a propósito si `DEMO_MODE=true` y `VERCEL_ENV=production`.

### 1.2 Rama de producción (ADR-010)

Hasta que esté el login real (etapa 2), producción no tiene cómo funcionar. Para que cada push a `main` genere un **Preview** en modo demo:

1. *Settings → Git → Production Branch* → escribir `produccion` (la rama todavía no existe; Vercel lo acepta).
2. Desde ese momento, cada push a `main` crea un deploy de Preview con su URL. La URL fija de la rama queda como `soporte-bi-git-main-<equipo>.vercel.app`.
3. Opcional: *Settings → Deployment Protection* → **Vercel Authentication** activado para Preview (solo gente del equipo de Vercel ve la demo).

### 1.3 Verificar el preview

1. Abrir la URL del preview → debería redirigir a **/bienvenida** con el aviso "Modo demo".
2. "Iniciar sesión con Microsoft" entra como *Ulises Usuario* (persona demo).
3. Con el botón flotante **"Modo demo · cambiar persona"** se recorren los roles.

### 1.4 Plan

Hobby alcanza para pruebas. **Antes de dar acceso a clientes** pasar a **Pro** (uso comercial, Vercel Firewall para rate limit, más ejecuciones de cron).

---

## 2. GitHub ✅

- El CI (`.github/workflows/ci.yml`) corre en cada push a `main` y en PRs: audit, lint, tipos, tests, build y e2e.
- Recomendado: *Settings → Branches → Branch protection* sobre `main`: requerir el check **"Lint, tipos, tests, build y e2e"**, prohibir *force push* y borrado de la rama.
- *Settings → Actions → General*: "Workflow permissions" en **Read repository contents** (el workflow ya pide `contents: read`).

---

## 3. Entra ID (tenant BHI) 🕒 etapa 2

Se detalla en la etapa 2. Adelanto de lo que se va a necesitar:

1. **App "Soporte BI – Portal"** (multi-tenant, web): redirect URI `https://<dominio>/api/auth/callback`; app roles `Soporte` y `Admin`; claim `groups` → "Groups assigned to the application"; asignar el grupo de soporte y los grupos satélite.
2. **App "Soporte BI – Datos"** (single tenant): permiso de aplicación `Sites.Selected` (admin consent) y `Mail.Send` (acotado con RBAC for Applications de Exchange al buzón `NOTIFY_MAILBOX`).
3. **Credenciales federadas** (sin secretos) en ambas apps para el proyecto de Vercel. Los valores exactos (issuer `https://oidc.vercel.com/<equipo>`, subject `owner:<equipo>:project:<proyecto>:environment:production`, audiencia) se confirman en la etapa 2 contra la documentación vigente de Vercel.
4. Habilitar **OIDC Federation** en el proyecto de Vercel (*Settings → Security*).

## 4. SharePoint 🕒 etapa 3

1. Crear el sitio **"Soporte BI"** en el tenant de BHI.
2. Otorgar a la app "Soporte BI – Datos" permiso `write` **solo sobre ese sitio** (Graph `POST /sites/{siteId}/permissions`).
3. Obtener `SP_SITE_ID` (`GET https://graph.microsoft.com/v1.0/sites/<host>:/sites/<ruta>` → `id`).
4. Correr `scripts/provision.ts` en dry run y luego con `--apply` (workflow de GitHub con credencial federada).

## 5. Exchange y Teams 🕒 etapa 4

- RBAC for Applications: limitar `Mail.Send` de la app Datos al buzón `NOTIFY_MAILBOX` (hoy `mlasserre@bhiconsultora.com.ar`).
- Teams: crear el canal de soporte y un flujo de Workflows "cuando se recibe una solicitud de webhook" → `TEAMS_WEBHOOK_URL`.

## 6. Variables de entorno (referencia)

| Variable | Obligatoria | Dónde se obtiene | Etapa |
|---|---|---|---|
| `DEMO_MODE` | Solo Preview/desarrollo | `true` | 0 |
| `APP_URL` | Sí (prod) | URL pública del portal | 2 |
| `SESSION_SECRET` | Sí (prod) | 64 caracteres aleatorios | 0/2 |
| `BHI_TENANT_ID` | Sí | Entra → Overview → Tenant ID | 2 |
| `PORTAL_CLIENT_ID` | Sí | App Portal → Application (client) ID | 2 |
| `DATA_CLIENT_ID` | Sí | App Datos → Application (client) ID | 3 |
| `SP_SITE_ID` | Sí | Graph (ver §4) | 3 |
| `NOTIFY_MAILBOX` | Sí | Buzón de envío | 4 |
| `TEAMS_WEBHOOK_URL` | No | Workflows de Teams | 4 |
| `CRON_SECRET` | Sí | 32+ caracteres aleatorios | 4 |
| `ANTHROPIC_API_KEY` | No | Consola de Anthropic (activa el triage automático) | 5 |
