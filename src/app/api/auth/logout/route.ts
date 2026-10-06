import { NextResponse } from "next/server";
import { conManejoDeErrores } from "@/infra/http";
import { borrarSesion } from "@/infra/sesion";

export const GET = conManejoDeErrores(async (request) => {
  await borrarSesion();
  return NextResponse.redirect(new URL("/bienvenida", request.url), 303);
});
