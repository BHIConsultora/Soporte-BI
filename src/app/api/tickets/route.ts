import { ESTADOS, type Estado } from "@/dominio/catalogos";
import { nuevoTicketSchema } from "@/dominio/esquemas";
import { leerMultipart, ok, rutaApi } from "@/infra/api";
import { crearTicket, listarTickets } from "@/servicios/tickets";

export const GET = rutaApi(async ({ request, ctx, deps }) => {
  const sp = new URL(request.url).searchParams;
  const estados = sp.getAll("estado").filter((e): e is Estado => (ESTADOS as readonly string[]).includes(e));
  return ok(
    await listarTickets(ctx, deps, {
      vista: sp.get("vista") ?? undefined,
      estados,
      q: sp.get("q") ?? undefined,
      cursor: sp.get("cursor"),
    }),
  );
});

export const POST = rutaApi(
  async ({ request, ctx, deps }) => {
    const { campos, archivos } = await leerMultipart(request);
    const input = nuevoTicketSchema.parse(campos);
    const { ticketId } = await crearTicket(ctx, deps, input, archivos);
    return ok({ ticketId }, 201);
  },
  { mutacion: true },
);
