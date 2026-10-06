import { NextResponse } from "next/server";
import { invalidarAcceso } from "@/infra/cache-acceso";
import { COOKIE_CSRF } from "@/infra/csrf";
import { conManejoDeErrores } from "@/infra/http";
import { borrarSesion, leerSesion } from "@/infra/sesion";

/** Cierra la sesión del portal (borra la cookie). La sesión de Microsoft del navegador no se toca. */
export const GET = conManejoDeErrores(async (request) => {
  const sesion = await leerSesion();
  if (sesion) invalidarAcceso(sesion.identidad);
  await borrarSesion();
  const res = NextResponse.redirect(new URL("/bienvenida", request.url), 303);
  res.cookies.delete({ name: COOKIE_CSRF, path: "/", secure: true });
  return res;
});
