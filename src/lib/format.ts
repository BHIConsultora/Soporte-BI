import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export const fecha = (iso: string) => format(new Date(iso), "d MMM yyyy", { locale: es });
export const fechaHora = (iso: string) => format(new Date(iso), "d MMM yyyy · HH:mm", { locale: es });
export const hace = (iso: string) => formatDistanceToNow(new Date(iso), { locale: es, addSuffix: true });
