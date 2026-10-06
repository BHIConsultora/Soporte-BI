import { comentarioSchema } from "@/dominio/esquemas";
import { idDeTicket, leerMultipart, ok, rutaApi } from "@/infra/api";
import { comentar } from "@/servicios/tickets";

export const POST = rutaApi<{ id: string }>(
  async ({ request, ctx, deps, params }) => {
    const { campos, archivos } = await leerMultipart(request);
    const { texto } = comentarioSchema.parse(campos);
    await comentar(ctx, deps, idDeTicket(params.id), texto, archivos);
    return ok(undefined, 201);
  },
  { mutacion: true },
);
