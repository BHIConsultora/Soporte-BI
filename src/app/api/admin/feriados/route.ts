import { feriadoSchema } from "@/dominio/esquemas";
import { leerJson, ok, rutaApi } from "@/infra/api";
import { cargarDatosAdmin, crearFeriado } from "@/servicios/admin";

export const GET = rutaApi(async ({ ctx, deps }) => ok((await cargarDatosAdmin(ctx, deps)).feriados));

export const POST = rutaApi(
  async ({ request, ctx, deps }) => ok(await crearFeriado(ctx, deps, await leerJson(request, feriadoSchema)), 201),
  { mutacion: true },
);
