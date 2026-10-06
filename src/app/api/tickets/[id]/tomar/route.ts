import { idDeTicket, ok, rutaApi } from "@/infra/api";
import { tomarTicket } from "@/servicios/soporte";

export const POST = rutaApi<{ id: string }>(
  async ({ ctx, deps, params }) => {
    await tomarTicket(ctx, deps, idDeTicket(params.id));
    return ok();
  },
  { mutacion: true },
);
