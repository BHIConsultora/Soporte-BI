import { createFileRoute } from "@tanstack/react-router";
import { Footer } from "@/components/portal/AppShell";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/no-habilitado")({
  head: () => ({
    meta: [
      { title: "Organización no habilitada · Soporte BI" },
      { name: "description", content: "Tu organización todavía no tiene habilitado el portal de soporte BI." },
      { property: "og:title", content: "Organización no habilitada · Soporte BI" },
      { property: "og:description", content: "Tu organización todavía no tiene habilitado el portal de soporte BI." },
    ],
  }),
  component: NoHabilitado,
});

function NoHabilitado() {
  const { logout } = useSession();
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="card-soft max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold">Todavía no está habilitado</h1>
          <p className="mt-3 text-muted-foreground">
            Tu organización todavía no tiene habilitado el portal de soporte. Escribinos a{" "}
            <a className="font-semibold text-main underline" href="mailto:mejoracontinua@bhiconsultora.com.ar">
              mejoracontinua@bhiconsultora.com.ar
            </a>
            .
          </p>
          <button onClick={logout} className="btn btn-secondary mt-6">Cerrar sesión</button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
