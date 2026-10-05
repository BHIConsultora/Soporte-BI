<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Frontend-only: all data goes through `src/lib/api.ts` to an external API; when `VITE_API_BASE` is empty, `src/lib/mock.ts` simulates API and login — keeps the portal testable without backend.
- Auth is client-side (MSAL) via `SessionProvider`; protected pages wrap content in `<Protected>` — tokens never exist during SSR.
