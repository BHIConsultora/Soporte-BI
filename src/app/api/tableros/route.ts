import { ok, rutaApi } from "@/infra/api";
import { listarTablerosCliente } from "@/servicios/tableros";

export const GET = rutaApi(async ({ ctx, deps }) => ok(await listarTablerosCliente(ctx, deps)));
