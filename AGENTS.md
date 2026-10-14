# AGENTS.md — Portal de Soporte BI

Guía para agentes (Claude Code y otros) que trabajen en este repo.

## Antes de tocar nada

- Fuente de verdad del diseño: `docs/CONTEXTO-PROYECTO.md`. Decisiones: `docs/DECISIONES.md`. Historia: `docs/BITACORA.md`.
- `RESUMEN-TECNICO.md` describe una versión anterior (TanStack Start + SharePoint). Sirve como antecedente, no como diseño vigente.
- La plataforma actual es **Vite + React Router + Supabase (Lovable Cloud)**: ver ADR-011 a ADR-014 y `docs/DEPLOY.md`.

## Reglas

- Se trabaja directo sobre `main`. Commits chicos con prefijo (`feat:`, `fix:`, `chore:`, `test:`, `docs:`), en castellano.
- **Nunca reescribir historia publicada**: sin `push --force`, sin `rebase`/`amend` de commits pusheados, sin `reset` remoto.
- Antes de cada push: `bun run lint`, `bun run typecheck`, `bun run test` y `bun run build` en verde.
- Gestor de paquetes: **bun**. No usar npm/yarn/pnpm ni generar otros lockfiles. `bunfig.toml` mantiene `minimumReleaseAge = 86400`.
- Código e identificadores en inglés; textos de UI, commits y documentación en castellano rioplatense.
- Nunca commitear secretos, datos reales de clientes ni emails reales. Datos de demo con `example.com`.
- Al terminar una tarea: entrada en `docs/BITACORA.md`.

## Arquitectura en una línea por capa

- `supabase/migrations/`: modelo de datos, RLS y funciones. **La autorización real vive acá.** Toda regla de acceso nueva se escribe en SQL y se prueba en `tests/supabase/` contra la lógica TS.
- `src/app/`: arranque de la SPA (rutas, `SesionProvider`, error boundary). `src/paginas/`: pantallas.
- `src/backend/`: interfaz `Backend` que usa la UI (sesión, acceso, acciones), con implementaciones `supabase.ts` y `demo.ts` (`VITE_DEMO_MODE=true`).
- `src/servicios/`: casos de uso. `resolverAcceso` es la especificación ejecutable de `acceso_actual()`; `filtroPorRol` elige la vista dentro del techo que pone RLS. Devuelven DTOs distintos para cliente y soporte.
- `src/repositorio/`: lecturas, con implementaciones `supabase/` y `demo/` (en memoria).
- `src/integrations/supabase/`: cliente y tipos con la convención de Lovable (Lovable puede regenerarlos).
- `src/dominio/`: tipos, enums y helpers puros (sin I/O). Los enums coinciden 1 a 1 con los de la migración.
- Ningún componente llama a `supabase` directamente: siempre por `Backend`/`Repositorio`.
- Nada de secretos en variables `VITE_*`: terminan en el navegador.
