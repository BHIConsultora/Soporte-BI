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

### 1.2 Rama `demo` (ADR-011)

`main` es la rama de producción de Vercel y, hasta que esté el login real (etapa 2), producción no funciona. Por eso **se trabaja sobre la rama `demo`**:

1. Cada push a `demo` crea un deploy de **Preview**, que lee `DEMO_MODE=true`. La URL fija de la rama queda como `soporte-bi-git-demo-<equipo>.vercel.app` (se ve en *Deployments* filtrando por la rama).
2. No usar el deploy de producción (`main`) hasta la etapa 3: aunque ya tenga login real (§3), todavía no tiene dónde guardar datos (SharePoint).
3. Opcional: *Settings → Deployment Protection* → **Vercel Authentication** activado para Preview (solo gente del equipo de Vercel ve la demo).

### 1.3 Verificar el preview

1. Abrir la URL del preview → debería redirigir a **/bienvenida** con el aviso "Modo demo".
2. Sin variables de Entra, "Iniciar sesión con Microsoft" entra como *Ulises Usuario* (persona demo). Con las variables de §3.4, aparecen los dos botones (ver §3.5).
3. Con el botón flotante **"Modo demo · cambiar persona"** se recorren los roles.

### 1.4 Plan

Hobby alcanza para pruebas. **Antes de dar acceso a clientes** pasar a **Pro** (uso comercial, Vercel Firewall para rate limit, más ejecuciones de cron).

---

## 2. GitHub ✅

- El CI (`.github/workflows/ci.yml`) corre en cada push a `main` o `demo` y en PRs: audit, lint, tipos, tests, build y e2e.
- Recomendado: *Settings → Branches → Branch protection* sobre `main` y `demo`: requerir el check **"Lint, tipos, tests, build y e2e"**, prohibir *force push* y borrado de la rama.
- *Settings → Actions → General*: "Workflow permissions" en **Read repository contents** (el workflow ya pide `contents: read`).

---

## 3. Entra ID (tenant BHI) ✅ etapa 2

Todo se hace en el portal de Entra (**entra.microsoft.com**) del tenant de BHI, con un usuario que pueda crear aplicaciones y dar consentimiento de administrador. Al final de cada paso queda anotado el dato que hay que cargar en Vercel.

### 3.1 App "Soporte BI – Portal" (login de clientes y de BHI)

1. **Identity → Applications → App registrations → New registration**
   - Nombre: `Soporte BI – Portal`.
   - *Supported account types*: **Accounts in any organizational directory (Any Microsoft Entra ID tenant – Multitenant)**. No elegir la opción que incluye cuentas personales.
   - *Redirect URI*: plataforma **Web**, `https://<dominio-de-producción>/api/auth/callback`.
   - Registrar. Anotar **Application (client) ID** → `PORTAL_CLIENT_ID` y **Directory (tenant) ID** → `BHI_TENANT_ID`.
2. **Authentication**
   - Agregar en *Web → Redirect URIs* (todas con `/api/auth/callback`, más una con `/consentimiento` para la vuelta del consentimiento de administrador):
     - Producción: `https://<dominio-de-producción>/api/auth/callback` y `https://<dominio-de-producción>/consentimiento`.
     - Preview de la rama demo: `https://soporte-bi-git-demo-<equipo>.vercel.app/api/auth/callback` y `.../consentimiento`.
     - Desarrollo local (opcional): `http://localhost:3000/api/auth/callback`.
   - *Implicit grant and hybrid flows*: **todo destildado** (usamos auth code + PKCE del lado del servidor).
   - *Allow public client flows*: **No**.
3. **Token configuration**
   - *Add optional claim* → **ID** → tildar `email` y `acct` (`acct` distingue miembros de invitados). Si pide agregar el permiso de Graph `email`, aceptar.
   - *Add groups claim* → **Security groups** → en *Customize token properties by type* → **ID: Group ID**. Y elegir **Groups assigned to the application** (así el token solo trae los grupos satélite y no todos los del usuario).
4. **App roles → Create app role** (dos veces):
   | Display name | Value | Allowed member types | Descripción |
   |---|---|---|---|
   | Soporte | `Soporte` | Users/Groups | Equipo de soporte de BHI |
   | Admin | `Admin` | Users/Groups | Administración del portal |
   El *Value* tiene que ser exactamente `Soporte` y `Admin` (mayúscula inicial).
5. **API permissions**: dejar solo Microsoft Graph **delegados** `openid`, `profile`, `email` (quitar `User.Read` si aparece: no se usa). **Grant admin consent for BHI**.
6. **Branding & properties**: completar *Publisher domain* y, si es posible, **Publisher verification** con el MPN ID de BHI. Sin verificación, Microsoft muestra "no verificado" y muchas organizaciones exigen consentimiento de un admin.
7. **Enterprise applications → Soporte BI – Portal** (el *service principal* en el tenant de BHI):
   - *Properties → Assignment required?* → **Yes**. Así, de BHI solo entran las personas o grupos asignados (soporte, admin, grupos satélite y "Piloto Soporte BI"). Los demás ven "no habilitado".
   - *Users and groups → Add user/group*:
     - Equipo de soporte → rol **Soporte**. Martín → rol **Admin**.
     - Cada **grupo de seguridad satélite** (uno por cliente satélite, más "Piloto Soporte BI") → rol por defecto. Su *Object ID* es el **GrupoId** que se carga en Admin → Clientes.
   > Los roles solo se respetan para cuentas del tenant de BHI. Si el admin de un cliente se asigna "Admin" en su propio tenant, el portal lo ignora (lo valida el servidor).

### 3.2 App "Soporte BI – Datos" (Graph app-only)

1. *New registration*: `Soporte BI – Datos`, **Single tenant**, sin redirect URI. Anotar el client ID → `DATA_CLIENT_ID`.
2. *API permissions → Microsoft Graph → Application permissions*:
   - `Sites.Selected` (etapa 3; el acceso al sitio se otorga aparte, ver §4).
   - `Mail.Send` (etapa 4; se acota a un buzón con RBAC, ver §5).
   - `GroupMember.Read.All` **solo si** alguna persona de BHI llegara a tener tantos grupos asignados a la app que el token no los incluya (*overage*). Con el claim limitado a grupos asignados es prácticamente imposible: **se puede omitir**. Si falta y ocurre, esa persona ve "no habilitado" (falla cerrado).
   - **Grant admin consent**.

### 3.3 Credenciales sin secretos: federación OIDC de Vercel

El portal no usa *client secrets*. En cada función, Vercel emite un token OIDC firmado, y Entra confía en él por una **credencial federada**.

1. **Vercel → proyecto → Settings → Security → Secure backend access with OIDC federation** → activar, modo **Team** (recomendado). Anotar el *slug* del equipo (`<equipo>`) y el nombre del proyecto (`<proyecto>`, p. ej. `soporte-bi`).
2. En **cada una de las dos apps** (Portal y Datos): **Certificates & secrets → Federated credentials → Add credential → Other issuer**, una por entorno:
   | Campo | Valor |
   |---|---|
   | Issuer | `https://oidc.vercel.com/<equipo>` |
   | Subject identifier | `owner:<equipo>:project:<proyecto>:environment:production` (y otra con `…:environment:preview`) |
   | Audience | `https://vercel.com/<equipo>` |
   | Name | `vercel-production` / `vercel-preview` |
   Son 4 credenciales en total (2 apps × 2 entornos). Entra no admite comodines en el *subject*: la de `preview` cubre todos los deploys de preview.
3. Verificación: al primer login real, si Entra responde `AADSTS70021` o `AADSTS700213` (no encontró una credencial que coincida), revisar que issuer, subject y audience coincidan **exactamente** (sin barra final) con los del token. El *subject* exacto aparece en Vercel, en la misma pantalla de OIDC.
4. **Si Entra no aceptara la federación** para logins de otros tenants con la app multi-tenant, el plan B es un **certificado**: se sube la parte pública a la app y la clave privada va como variable cifrada de Vercel. Avisar al equipo para activarlo; no hace falta tocar código de autorización.

### 3.4 Variables en Vercel

| Variable | Production | Preview (rama `demo`) |
|---|---|---|
| `APP_URL` | `https://<dominio-de-producción>` | `https://soporte-bi-git-demo-<equipo>.vercel.app` |
| `SESSION_SECRET` | 64 caracteres aleatorios | otros 64 caracteres aleatorios (no reutilizar) |
| `BHI_TENANT_ID` | Tenant ID de BHI | ídem |
| `PORTAL_CLIENT_ID` | Client ID de la app Portal | ídem |
| `DATA_CLIENT_ID` | Client ID de la app Datos | ídem (opcional en la etapa 2) |
| `DEMO_MODE` | **nunca** | `true` |

Para generar un `SESSION_SECRET`, en una terminal con bun:

```bash
bun -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3.5 Probar el login real en el preview (criterio de la etapa 2)

Con las variables de 3.4 cargadas en **Preview** junto con `DEMO_MODE=true`, la bienvenida del preview muestra dos botones: **"Iniciar sesión con Microsoft"** (real) y **"Entrar con una persona demo"**. Los datos siguen siendo los ficticios. Qué esperar con el login real:

| Quién entra | Qué tiene que pasar |
|---|---|
| Alguien de BHI con rol **Soporte** | Entra al kanban (con los tickets demo) |
| Martín (rol **Admin**) | Ve además "Administración" |
| Alguien de BHI **sin** rol ni grupo asignado | Microsoft lo frena (`AADSTS50105`) → pantalla "Tu cuenta no tiene acceso al portal" |
| Un invitado (B2B) en el tenant de BHI | "Tu cuenta no tiene acceso al portal" |
| Alguien de otra organización (p. ej. ENA) | Si su organización no consintió: pantalla **"Falta un permiso de tu organización"** con el link para su admin. Si ya consintió: "Tu organización todavía no está habilitada", y queda la **solicitud** en Admin → Solicitudes |
| Cancelar en la pantalla de Microsoft | Vuelve a la bienvenida con el aviso "Se canceló el inicio de sesión" |

La solicitud queda en la memoria de la demo (se pierde al reiniciarse la instancia). En la etapa 3 se guarda en SharePoint.

### 3.6 Consentimiento de otras organizaciones

En **Admin → Consentimiento** está el link para mandarle al administrador de Microsoft 365 de cada cliente con tenant propio. Tiene la forma:

`https://login.microsoftonline.com/organizations/adminconsent?client_id=<PORTAL_CLIENT_ID>&redirect_uri=<APP_URL>/consentimiento`

El permiso que se pide es solo `openid profile email` (nombre y email del usuario).

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
| `SESSION_SECRET` | Sí (prod) | 64 caracteres aleatorios (§3.4) | 0/2 |
| `BHI_TENANT_ID` | Sí | Entra → Overview → Tenant ID | 2 |
| `PORTAL_CLIENT_ID` | Sí | App Portal → Application (client) ID | 2 |
| `DATA_CLIENT_ID` | Sí (desde la etapa 3) | App Datos → Application (client) ID | 2/3 |
| `SP_SITE_ID` | Sí | Graph (ver §4) | 3 |
| `NOTIFY_MAILBOX` | Sí | Buzón de envío | 4 |
| `TEAMS_WEBHOOK_URL` | No | Workflows de Teams | 4 |
| `CRON_SECRET` | Sí | 32+ caracteres aleatorios | 4 |
| `ANTHROPIC_API_KEY` | No | Consola de Anthropic (activa el triage automático) | 5 |
| `ACCESO_CACHE_SEGUNDOS` | No | Caché del rol por usuario (0–300; por defecto 120, en demo 0) | 2 |
