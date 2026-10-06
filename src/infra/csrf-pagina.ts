import "server-only";
import { cookies } from "next/headers";
import { COOKIE_CSRF } from "./csrf";

/** Token CSRF para formularios HTML (campo oculto `csrf`). Lo pone `proxy.ts` en cada página. */
export async function tokenCsrfPagina(): Promise<string> {
  return (await cookies()).get(COOKIE_CSRF)?.value ?? "";
}
