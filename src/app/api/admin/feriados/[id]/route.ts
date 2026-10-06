import { ok, rutaApi } from "@/infra/api";
import { idNumerico } from "@/infra/api-ids";
import { eliminarFeriado } from "@/servicios/admin";

export const DELETE = rutaApi<{ id: string }>(
  async ({ ctx, deps, params }) => {
    await eliminarFeriado(ctx, deps, idNumerico(params.id, "El feriado"));
    return ok();
  },
  { mutacion: true },
);
