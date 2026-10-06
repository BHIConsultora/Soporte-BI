import type { Metadata } from "next";
import { FormularioNuevo } from "@/components/tickets/formulario-nuevo";
import { parsearContexto } from "@/dominio/esquemas";
import { getDeps } from "@/infra/api";
import { requerirCliente } from "@/infra/contexto";
import { listarTablerosCliente } from "@/servicios/tableros";

export const metadata: Metadata = { title: "Nuevo reclamo" };

type Params = { tablero?: string; pagina?: string; ctx?: string };

export default async function NuevoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await requerirCliente();
  const tableros = await listarTablerosCliente(ctx, await getDeps());
  const sp = await searchParams;

  // `tablero` es una sugerencia: solo se usa si es de un tablero activo del cliente de la sesión.
  const sugerido = typeof sp.tablero === "string" ? tableros.find((t) => t.tableroId === sp.tablero) : undefined;
  const pagina = sugerido && typeof sp.pagina === "string" && /^[\w-]{1,100}$/.test(sp.pagina) ? sp.pagina : null;
  const contexto = typeof sp.ctx === "string" ? parsearContexto(sp.ctx) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-main sm:text-3xl">Nuevo reclamo</h1>
        <p className="text-muted-foreground">Contanos qué pasa con tu tablero y lo revisamos.</p>
      </div>
      <FormularioNuevo
        tableros={tableros}
        tableroInicial={sugerido?.tableroId ?? null}
        paginaInicial={pagina}
        contexto={contexto ? JSON.stringify(contexto) : null}
        contextoVisible={contexto}
      />
    </div>
  );
}
