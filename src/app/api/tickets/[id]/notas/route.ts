import { comentarioSchema } from "@/dominio/esquemas";
import { idDeTicket, leerJson, ok, rutaApi } from "@/infra/api";
import { agregarNotaInterna } from "@/servicios/soporte";

export const POST = rutaApi<{ id: string }>(
  async ({ request, ctx, deps, params }) => {
    const { texto } = await leerJson(request, comentarioSchema);
    await agregarNotaInterna(ctx, deps, idDeTicket(params.id), texto);
    return ok(undefined, 201);
  },
  { mutacion: true },
);
