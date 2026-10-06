# AGENTS.md — Portal de Soporte BI

Guía para agentes (Claude Code y otros) que trabajen en este repo.

## Antes de tocar nada

- Fuente de verdad del diseño: `docs/CONTEXTO-PROYECTO.md`. Decisiones: `docs/DECISIONES.md`. Historia: `docs/BITACORA.md`.
- `RESUMEN-TECNICO.md` describe la **versión anterior** (Lovable + Supabase). Sirve como antecedente, no como diseño vigente.

## Reglas

- Se trabaja directo sobre `main`. Commits chicos con prefijo (`feat:`, `fix:`, `chore:`, `test:`, `docs:`), en castellano.
- **Nunca reescribir historia publicada**: sin `push --force`, sin `rebase`/`amend` de commits pusheados, sin `reset` remoto.
- Antes de cada push: `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde.
- Gestor de paquetes: **bun**. No usar npm/yarn/pnpm ni generar otros lockfiles. `bunfig.toml` mantiene `minimumReleaseAge = 86400`.
- Código e identificadores en inglés; textos de UI, commits y documentación en castellano rioplatense.
- Nunca commitear secretos, datos reales de clientes ni emails reales. Datos de demo con `example.com`.
- Al terminar una tarea: entrada en `docs/BITACORA.md`.

## Arquitectura en una línea por capa

- `src/app/`: Next.js App Router (pantallas y route handlers). Los handlers solo validan (zod), arman la sesión y llaman a `servicios/`.
- `src/servicios/`: casos de uso + **autorización** (por recurso, desde la sesión validada). Devuelven DTOs distintos para cliente y soporte.
- `src/repositorio/`: interfaces de persistencia con dos implementaciones: `sharepoint/` (Graph) y `demo/` (en memoria, solo con `DEMO_MODE=true`).
- `src/infra/`: Graph, auth (MSAL Node + sesión cifrada), CSRF, rate limit, mailer, notifier, logger, entorno.
- `src/dominio/`: tipos, enums, esquemas zod, SLA y helpers puros (sin I/O).
- Ningún componente ni handler llama a Graph directamente.
