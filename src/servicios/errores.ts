/** Error esperable de negocio/autorización. El handler lo traduce a `{ error, code, requestId }`. */
export class ErrorServicio extends Error {
  constructor(
    readonly status: 401 | 403 | 404 | 409 | 413 | 422 | 429,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ErrorServicio";
  }
}

export const noEncontrado = (que = "El reclamo") => new ErrorServicio(404, `${que} no existe o no tenés acceso.`);
export const sinPermiso = (mensaje = "No tenés permiso para hacer esto.") => new ErrorServicio(403, mensaje, "sin_permiso");
export const conflicto = (mensaje: string, code?: string) => new ErrorServicio(409, mensaje, code);
export const invalido = (mensaje: string, code?: string) => new ErrorServicio(422, mensaje, code);
