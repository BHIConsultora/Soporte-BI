import { noEncontrado } from "@/servicios/errores";

/** IDs numéricos de la URL (ítems de SharePoint). Cualquier otra cosa → 404. */
export function idNumerico(valor: string, que = "El recurso"): number {
  if (!/^\d{1,9}$/.test(valor)) throw noEncontrado(que);
  return Number(valor);
}

export const idDeBorrador = (valor: string) => idNumerico(valor, "El borrador");
