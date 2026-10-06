import { solicitudSchema } from "@/dominio/esquemas";
import { leerJson, ok, rutaApi } from "@/infra/api";
import { idNumerico } from "@/infra/api-ids";
import { resolverSolicitud } from "@/servicios/admin";

export const PATCH = rutaApi<{ id: string }>(
  async ({ request, ctx, deps, params }) => {
    const { estado } = await leerJson(request, solicitudSchema);
    return ok(await resolverSolicitud(ctx, deps, idNumerico(params.id, "La solicitud"), estado));
  },
  { mutacion: true },
);
