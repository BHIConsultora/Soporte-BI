# Portal de Soporte BI

Gestión de reclamos sobre los tableros de Power BI que BHI Consultora Regional mantiene para sus clientes.

SPA con Vite + React, pensada para desplegarse en **Lovable** con **Lovable Cloud (Supabase)** como backend y login con cuentas de Microsoft (Entra ID).

- Deploy en Lovable, Supabase y Entra ID: [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Modelo de datos, RLS y funciones: [`supabase/migrations/`](supabase/migrations/)
- Diseño y alcance: [`docs/CONTEXTO-PROYECTO.md`](docs/CONTEXTO-PROYECTO.md)
- Decisiones: [`docs/DECISIONES.md`](docs/DECISIONES.md) · Bitácora: [`docs/BITACORA.md`](docs/BITACORA.md)

## Desarrollo local

Requiere [bun](https://bun.sh).

```sh
bun install
cp .env.example .env.local   # VITE_DEMO_MODE=true para trabajar sin Supabase
bun run dev                  # http://localhost:8080
```

| Script | Qué hace |
|---|---|
| `bun run dev` | Servidor de desarrollo (Vite) |
| `bun run build` | Build de producción (`dist/`) |
| `bun run preview` | Sirve el build |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript sin emitir |
| `bun run test` | Vitest (incluye la migración de Supabase sobre PGlite) |
| `bun run e2e` | Playwright contra el build en modo demo |
