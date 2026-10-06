import { idDeTicket, ok, rutaApi } from "@/infra/api";
import { idDeBorrador } from "@/infra/api-ids";
import { descartarBorrador } from "@/servicios/soporte";

export const DELETE = rutaApi<{ id: string; bid: string }>(
  async ({ ctx, deps, params }) => {
    await descartarBorrador(ctx, deps, idDeTicket(params.id), idDeBorrador(params.bid));
    return ok();
  },
  { mutacion: true },
);
