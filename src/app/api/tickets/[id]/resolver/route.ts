import { idDeTicket, ok, rutaApi } from "@/infra/api";
import { resolverPorCliente } from "@/servicios/tickets";

export const POST = rutaApi<{ id: string }>(
  async ({ ctx, deps, params }) => {
    await resolverPorCliente(ctx, deps, idDeTicket(params.id));
    return ok();
  },
  { mutacion: true },
);
