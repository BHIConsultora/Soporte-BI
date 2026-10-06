import { publicarBorradorSchema } from "@/dominio/esquemas";
import { idDeTicket, leerJson, ok, rutaApi } from "@/infra/api";
import { idDeBorrador } from "@/infra/api-ids";
import { publicarBorrador } from "@/servicios/soporte";

export const POST = rutaApi<{ id: string; bid: string }>(
  async ({ request, ctx, deps, params }) => {
    const { texto } = await leerJson(request, publicarBorradorSchema);
    await publicarBorrador(ctx, deps, idDeTicket(params.id), idDeBorrador(params.bid), texto);
    return ok();
  },
  { mutacion: true },
);
