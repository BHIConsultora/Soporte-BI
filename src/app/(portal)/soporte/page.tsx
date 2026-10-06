import type { Metadata } from "next";
import { Kanban, type TarjetaKanban } from "@/components/soporte/kanban";
import { ESTADOS_ABIERTOS } from "@/dominio/catalogos";
import { semaforoSLA } from "@/dominio/sla";
import { getDeps } from "@/infra/api";
import { requerirSoporte } from "@/infra/contexto";
import { listarKanban } from "@/servicios/tickets";

export const metadata: Metadata = { title: "Soporte" };

export default async function SoportePage() {
  const ctx = await requerirSoporte();
  const deps = await getDeps();
  const [tickets, feriados] = await Promise.all([listarKanban(ctx, deps), deps.repo.feriados.listar()]);
  const dias = new Set(feriados.map((f) => f.fecha));
  const ahora = deps.ahora();

  const tarjetas: TarjetaKanban[] = tickets.map((t) => ({
    ...t,
    semaforo:
      t.venceSLA && ESTADOS_ABIERTOS.includes(t.estado) ? semaforoSLA(new Date(t.fechaAlta), new Date(t.venceSLA), ahora, dias) : null,
  }));
  const clientes = [...new Set(tickets.map((t) => t.cliente))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-main sm:text-3xl">Reclamos</h1>
        <p className="text-muted-foreground">Arrastrá las tarjetas para cambiar el estado, o abrí un reclamo para ver el detalle.</p>
      </div>
      <Kanban tickets={tarjetas} yo={ctx.identidad.email.toLowerCase()} clientes={clientes} />
    </div>
  );
}
