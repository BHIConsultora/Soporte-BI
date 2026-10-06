import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { AdminAreas } from "@/components/admin/areas";
import { AdminClientes } from "@/components/admin/clientes";
import { AdminTableros } from "@/components/admin/tableros";
import { AdminConsentimiento, AdminFeriados, AdminSolicitudes } from "@/components/admin/varios";
import { getDeps } from "@/infra/api";
import { requerirAdmin } from "@/infra/contexto";
import { linkConsentimiento } from "@/infra/entra";
import { getEnv } from "@/infra/env";
import { cn } from "@/lib/utils";
import { cargarDatosAdmin } from "@/servicios/admin";

export const metadata: Metadata = { title: "Administración" };

const SECCIONES = [
  { id: "clientes", titulo: "Clientes" },
  { id: "areas", titulo: "Áreas" },
  { id: "tableros", titulo: "Tableros" },
  { id: "solicitudes", titulo: "Solicitudes" },
  { id: "feriados", titulo: "Feriados" },
  { id: "consentimiento", titulo: "Consentimiento" },
] as const;
type Seccion = (typeof SECCIONES)[number]["id"];

async function urlPublica(): Promise<string> {
  const env = getEnv();
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "localhost"}`;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ seccion?: string }> }) {
  const ctx = await requerirAdmin();
  const pedida = (await searchParams).seccion;
  const seccion: Seccion = SECCIONES.some((s) => s.id === pedida) ? (pedida as Seccion) : "clientes";
  const datos = await cargarDatosAdmin(ctx, await getDeps());
  const pendientes = datos.solicitudes.filter((s) => s.estado === "pendiente").length;
  const titulo = SECCIONES.find((s) => s.id === seccion)!.titulo;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-main sm:text-3xl">Administración</h1>
      <nav aria-label="Secciones de administración" className="flex flex-wrap gap-2">
        {SECCIONES.map((s) => (
          <Link
            key={s.id}
            href={`/admin?seccion=${s.id}`}
            aria-current={s.id === seccion ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 font-display text-sm",
              s.id === seccion ? "border-main bg-main text-on-main" : "border-main/30 bg-surface text-main hover:bg-accent",
            )}
          >
            {s.titulo}
            {s.id === "solicitudes" && pendientes > 0 && <span className="ml-1.5 rounded-full bg-p1 px-1.5 text-xs text-p1-fg">{pendientes}</span>}
          </Link>
        ))}
      </nav>
      <section aria-labelledby="seccion-titulo" className="space-y-4">
        <h2 id="seccion-titulo" className="font-display text-xl font-semibold">
          {titulo}
        </h2>
        {seccion === "clientes" && <AdminClientes clientes={datos.clientes} />}
        {seccion === "areas" && <AdminAreas areas={datos.areas} clientes={datos.clientes} />}
        {seccion === "tableros" && <AdminTableros tableros={datos.tableros} areas={datos.areas} clientes={datos.clientes} appUrl={await urlPublica()} />}
        {seccion === "solicitudes" && <AdminSolicitudes solicitudes={datos.solicitudes} />}
        {seccion === "feriados" && <AdminFeriados feriados={datos.feriados} />}
        {seccion === "consentimiento" && <AdminConsentimiento link={linkConsentimiento()} />}
      </section>
    </div>
  );
}
