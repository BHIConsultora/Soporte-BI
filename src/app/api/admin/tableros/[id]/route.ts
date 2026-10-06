import { slugSchema, tableroSchema } from "@/dominio/esquemas";
import { leerJson, ok, rutaApi } from "@/infra/api";
import { actualizarTablero } from "@/servicios/admin";
import { noEncontrado } from "@/servicios/errores";

export const PATCH = rutaApi<{ id: string }>(
  async ({ request, ctx, deps, params }) => {
    const id = slugSchema.safeParse(params.id);
    if (!id.success) throw noEncontrado("El tablero");
    return ok(await actualizarTablero(ctx, deps, id.data, await leerJson(request, tableroSchema)));
  },
  { mutacion: true },
);
