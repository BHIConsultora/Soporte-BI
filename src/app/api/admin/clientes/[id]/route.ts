import { clienteSchema } from "@/dominio/esquemas";
import { leerJson, ok, rutaApi } from "@/infra/api";
import { idNumerico } from "@/infra/api-ids";
import { actualizarCliente } from "@/servicios/admin";

export const PATCH = rutaApi<{ id: string }>(
  async ({ request, ctx, deps, params }) =>
    ok(await actualizarCliente(ctx, deps, idNumerico(params.id, "El cliente"), await leerJson(request, clienteSchema))),
  { mutacion: true },
);
