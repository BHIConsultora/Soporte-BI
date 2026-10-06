import { tableroSchema } from "@/dominio/esquemas";
import { leerJson, ok, rutaApi } from "@/infra/api";
import { cargarDatosAdmin, crearTablero } from "@/servicios/admin";

export const GET = rutaApi(async ({ ctx, deps }) => ok((await cargarDatosAdmin(ctx, deps)).tableros));

export const POST = rutaApi(
  async ({ request, ctx, deps }) => ok(await crearTablero(ctx, deps, await leerJson(request, tableroSchema)), 201),
  { mutacion: true },
);
