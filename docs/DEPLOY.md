# Deploy y configuración (Lovable + Supabase + Entra ID)

Pasos para quien levante el portal en Lovable. Arquitectura y motivos: ADR-011 a ADR-014 en `DECISIONES.md`.

Resumen: **Lovable** compila y publica la SPA (Vite) · **Lovable Cloud (Supabase)** tiene la base, la autorización (RLS) y el login · **Entra ID** pone las cuentas de Microsoft (las apps ya están creadas).

---

## 1. Llevar el repo a Lovable

1. Crear un proyecto en Lovable y conectarlo a GitHub (*Settings → GitHub*). Lovable sincroniza en los dos sentidos con la rama por defecto.
2. Subir este código a ese repositorio (o, si Lovable permite importar un repo existente, importar este directamente).
3. Lovable detecta Vite solo: `vite` en desarrollo (puerto 8080, ya configurado en `vite.config.ts`) y `vite build` para publicar. No hace falta configurar nada más del build.

### 1.1 Probar en modo demo (opcional, sin backend)

Para ver el portal antes de conectar Supabase, cargar en *Settings → Environment* (o en `.env`) `VITE_DEMO_MODE=true`. Entra con personas ficticias y un selector flotante para cambiar de rol.

> ⚠️ El build **falla a propósito** si `VITE_DEMO_MODE=true` y además existe `VITE_SUPABASE_URL`. Al conectar Lovable Cloud hay que quitar `VITE_DEMO_MODE`.

## 2. Backend: Lovable Cloud (Supabase)

1. En Lovable, activar **Cloud** (o conectar un proyecto propio de Supabase). Lovable carga solas `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Aplicar la migración **`supabase/migrations/20261014000000_modelo_inicial.sql`**: pedirle a Lovable que la ejecute, o pegarla en el editor SQL del proyecto. Crea tablas, enums, RLS, funciones y el bucket privado `adjuntos`.
3. Si Lovable regenera `src/integrations/supabase/types.ts` o `client.ts`, el resultado tiene que ser equivalente: el cliente se exporta como `supabase` y usa las mismas dos variables.

## 3. Login con Microsoft (Entra ID → Supabase Auth)

Se usa la app **"Soporte BI – Portal"** del tenant de BHI (multi-tenant).

### 3.1 En Entra ID (portal de Azure → App registrations → Soporte BI – Portal)

1. **Authentication → Add a platform → Web** con redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`
   (el `project-ref` sale de `VITE_SUPABASE_URL`).
2. **Supported account types:** "Accounts in any organizational directory" (multi-tenant).
3. **Certificates & secrets → New client secret.** Copiar el valor (solo se ve una vez). Va **solo** en Supabase, nunca en el repo ni en variables `VITE_*`. Anotar el vencimiento para rotarlo.
4. **Token configuration → Add optional claim → ID → `email`** y **`xms_edov`** (Supabase lo usa para dar el email por verificado).
5. Los app roles `Soporte`/`Admin` y el claim `groups` **ya no se usan** (ADR-012): el personal y los satélites se cargan en la base (§4).

### 3.2 En Supabase (Authentication → Providers → Azure)

| Campo | Valor |
|---|---|
| Enabled | sí |
| Application (client) ID | ID de la app Portal |
| Secret value | el client secret del paso 3.1.3 |
| Azure Tenant URL | `https://login.microsoftonline.com/organizations` (cualquier organización, sin cuentas personales) |

### 3.3 En Supabase (Authentication → URL Configuration)

- **Site URL:** la URL publicada del portal (p. ej. `https://soporte.bhiconsultora.com.ar`).
- **Redirect URLs:** `https://<dominio-publicado>/auth/callback` y la del preview de Lovable (`https://<preview>.lovable.app/auth/callback`). Para desarrollo local: `http://localhost:8080/auth/callback`.

### 3.4 Consentimiento por cliente

La primera vez que entra alguien de un tenant cliente, Entra puede pedir consentimiento de administrador (depende de la política del tenant y de si la app tiene publisher verification). Link de admin consent para mandarle al admin del cliente:
`https://login.microsoftonline.com/organizations/adminconsent?client_id=<client-id-de-la-app-Portal>`

## 4. Datos iniciales (editor SQL)

Emails siempre en minúsculas.

```sql
-- Tenant de BHI (Entra → Overview → Tenant ID). Sin esta fila nadie de BHI tiene acceso.
insert into public.configuracion (bhi_tenant_id) values ('<tenant-id-de-bhi>');

-- Personal de BHI (reemplaza los app roles Soporte/Admin).
insert into public.personal_bhi (email, nombre, rol) values
  ('mlasserre@bhiconsultora.com.ar', 'Martín Lasserre', 'admin');

-- Cliente con tenant propio: el tenant_id es la lista de permitidos.
insert into public.cliente (nombre, tipo, tenant_id, dominio, referentes, notas_contexto)
values ('<Cliente>', 'tenant', '<tenant-id-del-cliente>', '<dominio>', array['referente@cliente.com'], '<contexto para soporte>')
returning id;

-- Cliente satélite (cuentas del tenant de BHI) y sus miembros (reemplaza los grupos de Entra).
insert into public.cliente (nombre, tipo, dominio) values ('<Satélite>', 'satelite', '<dominio>') returning id;
insert into public.cliente_miembro (cliente_id, email) values (<id>, 'persona@bhiconsultora.com.ar');

-- Áreas, tableros (slug estable = el que manda el botón de Power BI) y su relación.
insert into public.area (cliente_id, nombre, lideres) values (<id>, 'Comercial', array['lider@cliente.com']) returning id;
insert into public.tablero (id, cliente_id, nombre, paginas) values ('ventas-dtc', <id>, 'Ventas DTC', array['resumen']);
insert into public.tablero_area (tablero_id, area_id, cliente_id) values ('ventas-dtc', <area_id>, <id>);

-- Feriados (SLA en horas hábiles).
insert into public.feriado (fecha, descripcion) values ('2026-12-25', 'Navidad');
```

Si alguien entra desde un tenant no habilitado, queda una fila en `solicitud_acceso` para revisar.

## 5. Verificar

1. Abrir la URL publicada → redirige a **/bienvenida**.
2. "Iniciar sesión con Microsoft" → login de Microsoft → vuelve a la página pedida.
3. Con una cuenta de BHI cargada en `personal_bhi` se ven todos los tickets; con una cuenta de un cliente, solo lo que permite su rol (§5 del contexto).
4. Una cuenta de un tenant no cargado ve "Tu organización todavía no está habilitada" y aparece en `solicitud_acceso`.

## 6. Seguridad: qué cambia respecto de la versión anterior

- La autorización está en **RLS** (`supabase/migrations/`), no en un servidor propio. La clave publicable de Supabase es pública por diseño.
- **Nunca** usar la `service_role` key en el frontend ni en variables `VITE_*`.
- La CSP va en un `<meta>` del build (ADR-013). Lovable no permite headers: `frame-ancestors`, HSTS y `X-Frame-Options` requieren un proxy delante del dominio propio.
- `tests/supabase/` prueba la migración contra la lógica TS; correr `bun run test` antes de cambiar cualquier política.

## 7. GitHub

- El CI (`.github/workflows/ci.yml`) corre en cada push a `main` y en PRs: audit, lint, tipos, tests (incluye la migración sobre PGlite), build y e2e en modo demo.
- Recomendado: *Branch protection* sobre `main` requiriendo el check **"Lint, tipos, tests, build y e2e"**.

## 8. Variables de entorno (todas públicas)

| Variable | Dónde | Notas |
|---|---|---|
| `VITE_SUPABASE_URL` | Lovable Cloud (automática) | |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Lovable Cloud (automática) | Pública por diseño |
| `VITE_DEMO_MODE` | Solo desarrollo/preview | `true` = datos ficticios; incompatible con `VITE_SUPABASE_URL` |

Secretos (client secret de Entra; a futuro, claves de correo, Teams o Anthropic para Edge Functions) van en Supabase (*Authentication → Providers* o *Edge Functions → Secrets*), nunca en el repo.
