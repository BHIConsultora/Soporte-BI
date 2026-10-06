import { ok, rutaApi } from "@/infra/api";
import { cargarDatosAdmin } from "@/servicios/admin";

export const GET = rutaApi(async ({ ctx, deps }) => ok((await cargarDatosAdmin(ctx, deps)).solicitudes));
