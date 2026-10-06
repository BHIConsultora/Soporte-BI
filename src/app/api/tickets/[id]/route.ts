import { cambiosSoporteSchema } from "@/dominio/esquemas";
import { idDeTicket, leerJson, ok, rutaApi } from "@/infra/api";
import { esBhi } from "@/servicios/autorizacion";
import { actualizarTicket } from "@/servicios/soporte";
import { obtenerTicketCliente, obtenerTicketSoporte } from "@/servicios/tickets";

export const GET = rutaApi<{ id: string }>(async ({ ctx, deps, params }) => {
  const id = idDeTicket(params.id);
  return ok(esBhi(ctx) ? await obtenerTicketSoporte(ctx, deps, id) : await obtenerTicketCliente(ctx, deps, id));
});

export const PATCH = rutaApi<{ id: string }>(
  async ({ request, ctx, deps, params }) => {
    const cambios = await leerJson(request, cambiosSoporteSchema);
    await actualizarTicket(ctx, deps, idDeTicket(params.id), cambios);
    return ok();
  },
  { mutacion: true },
);
