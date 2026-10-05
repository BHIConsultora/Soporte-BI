import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/session";
import { LogoLong } from "@/components/portal/Logo";

export const Route = createFileRoute("/bienvenida")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s["redirect"] === "string" && s["redirect"].startsWith("/") && !s["redirect"].startsWith("/bienvenida") ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Bienvenida · Portal de Soporte BI" },
      { name: "description", content: "Iniciá sesión con tu cuenta de Microsoft para reportar problemas en tus tableros." },
      { property: "og:title", content: "Bienvenida · Portal de Soporte BI" },
      { property: "og:description", content: "Iniciá sesión con tu cuenta de Microsoft para reportar problemas en tus tableros." },
    ],
  }),
  component: Bienvenida,
});

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 21 21" className="h-4 w-4" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function Bienvenida() {
  const { redirect } = Route.useSearch();
  const { status, login } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authed") navigate({ to: redirect ?? "/", replace: true });
  }, [status, redirect, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-main text-on-main">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
        <LogoLong className="mb-10 scale-125" />
        <h1 className="text-4xl font-semibold sm:text-5xl">Portal de Soporte BI</h1>
        <p className="mt-4 text-lg opacity-85">Reportá problemas en tus tableros y seguí el estado de tus reclamos.</p>
        <button
          disabled={busy || status === "loading"}
          onClick={async () => { setBusy(true); try { await login(redirect ?? "/"); } finally { setBusy(false); } }}
          className="btn btn-secondary mt-10 px-6 py-3 text-base"
        >
          {busy || status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MicrosoftIcon />}
          Iniciar sesión con Microsoft
        </button>
        <p className="mt-4 text-sm opacity-75">Usá la misma cuenta de tu empresa con la que entrás a Power BI.</p>
      </main>
      <footer className="pb-6 text-center text-xs opacity-70">
        BHI Consultora Regional · Soporte de Tableros BI · mejoracontinua@bhiconsultora.com.ar
      </footer>
    </div>
  );
}
