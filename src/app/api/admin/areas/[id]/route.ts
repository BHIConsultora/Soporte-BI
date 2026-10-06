import { areaSchema } from "@/dominio/esquemas";
import { leerJson, ok, rutaApi } from "@/infra/api";
import { idNumerico } from "@/infra/api-ids";
import { actualizarArea } from "@/servicios/admin";

export const PATCH = rutaApi<{ id: string }>(
  async ({ request, ctx, deps, params }) =>
    ok(await actualizarArea(ctx, deps, idNumerico(params.id, "El área"), await leerJson(request, areaSchema))),
  { mutacion: true },
);
