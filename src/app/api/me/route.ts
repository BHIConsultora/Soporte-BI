import { NextResponse } from "next/server";
import { obtenerContexto } from "@/infra/contexto";
import { conManejoDeErrores, errorJson } from "@/infra/http";

export const GET = conManejoDeErrores(async (_request, requestId) => {
  const ctx = await obtenerContexto();
  if (!ctx) return errorJson(requestId, 401, "Tenés que iniciar sesión.");
  const { identidad, acceso } = ctx;

  if (acceso.tipo === "denegado") return errorJson(requestId, 403, "Tu cuenta no está habilitada.", acceso.code);
  if (acceso.tipo === "elegir_cliente") {
    return errorJson(requestId, 409, "Elegí con qué cliente vas a trabajar.", "elegir_cliente");
  }

  return NextResponse.json({
    nombre: identidad.nombre,
    email: identidad.email,
    cliente: acceso.tipo === "cliente" ? acceso.cliente.nombre : "BHI Consultora",
    rol: acceso.rol,
    areas: acceso.tipo === "cliente" ? acceso.areasLideradas.map((a) => ({ id: a.id, nombre: a.nombre })) : [],
  });
});
