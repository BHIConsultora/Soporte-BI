import { clienteSchema } from "@/dominio/esquemas";
import { leerJson, ok, rutaApi } from "@/infra/api";
import { cargarDatosAdmin, crearCliente } from "@/servicios/admin";

export const GET = rutaApi(async ({ ctx, deps }) => ok((await cargarDatosAdmin(ctx, deps)).clientes));

export const POST = rutaApi(
  async ({ request, ctx, deps }) => ok(await crearCliente(ctx, deps, await leerJson(request, clienteSchema)), 201),
  { mutacion: true },
);
