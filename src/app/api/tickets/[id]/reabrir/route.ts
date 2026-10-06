import { idDeTicket, ok, rutaApi } from "@/infra/api";
import { reabrirPorCliente } from "@/servicios/tickets";

export const POST = rutaApi<{ id: string }>(
  async ({ ctx, deps, params }) => {
    await reabrirPorCliente(ctx, deps, idDeTicket(params.id));
    return ok();
  },
  { mutacion: true },
);
