# Portal de Soporte BI

Gestión de reclamos sobre los tableros de Power BI que BHI Consultora Regional mantiene para sus clientes.

- Diseño y alcance: [`docs/CONTEXTO-PROYECTO.md`](docs/CONTEXTO-PROYECTO.md)
- Deploy y configuración de Microsoft 365 / Vercel: [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Decisiones: [`docs/DECISIONES.md`](docs/DECISIONES.md) · Bitácora: [`docs/BITACORA.md`](docs/BITACORA.md)

## Desarrollo local

Requiere [bun](https://bun.sh).

```sh
bun install
cp .env.example .env.local   # DEMO_MODE=true para trabajar sin Microsoft 365
bun run dev
```

| Script | Qué hace |
|---|---|
| `bun run dev` | Servidor de desarrollo |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript sin emitir |
| `bun run test` | Vitest |
| `bun run e2e` | Playwright (modo demo) |
| `bun run build` | Build de producción |
