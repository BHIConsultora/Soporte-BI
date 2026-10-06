import { z } from "zod";
import { dominioSchema } from "@/dominio/esquemas";
import { leerJson, ok, rutaApi } from "@/infra/api";
import { resolverTenantPorDominio } from "@/infra/entra";
import { exigirAdmin } from "@/servicios/autorizacion";
import { invalido } from "@/servicios/errores";

/** Alta de cliente por dominio: devuelve el TenantId de Entra ID. */
export const POST = rutaApi(
  async ({ request, ctx }) => {
    exigirAdmin(ctx);
    const { dominio } = await leerJson(request, z.object({ dominio: dominioSchema }).strict());
    const tenantId = await resolverTenantPorDominio(dominio);
    if (!tenantId) throw invalido("No encontramos un tenant de Microsoft para ese dominio.", "dominio_sin_tenant");
    return ok({ tenantId });
  },
  { mutacion: true },
);
