import { areaSchema } from "@/dominio/esquemas";
import { leerJson, ok, rutaApi } from "@/infra/api";
import { cargarDatosAdmin, crearArea } from "@/servicios/admin";

export const GET = rutaApi(async ({ ctx, deps }) => ok((await cargarDatosAdmin(ctx, deps)).areas));

export const POST = rutaApi(
  async ({ request, ctx, deps }) => ok(await crearArea(ctx, deps, await leerJson(request, areaSchema)), 201),
  { mutacion: true },
);
