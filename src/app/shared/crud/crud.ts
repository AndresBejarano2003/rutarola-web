import { HttpErrorResponse } from '@angular/common/http';

/** Todo registro manejado por un CRUD tiene un id y fechas de auditoría. */
export interface Entidad {
  id: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

/** Datos que se envían al crear o actualizar (sin campos generados por el servidor). */
export type DatosRegistro<T extends Entidad> = Omit<T, 'id' | 'fechaCreacion' | 'fechaActualizacion'>;

/** Paginación 1-based. */
export interface Paginacion {
  pagina: number;
  tamano: number;
}

/** Respuesta paginada que se espera del API: `GET /recurso?pagina=1&tamano=10&...`. */
export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  tamano: number;
}

export type ModoFormulario = 'crear' | 'editar' | 'consultar';

/** Estado estándar de un registro (estudiantes, acudientes, empleados...). */
export type EstadoRegistro = 'ACTIVO' | 'INACTIVO';

export const ESTADOS_REGISTRO: { id: EstadoRegistro; nombre: string }[] = [
  { id: 'ACTIVO', nombre: 'Activo' },
  { id: 'INACTIVO', nombre: 'Inactivo' },
];

export type CodigoErrorCrud = 'NO_ENCONTRADO' | 'DUPLICADO' | 'VALIDACION' | 'EN_USO' | 'SIN_ESPACIO';

/** Error de negocio con un mensaje listo para mostrar al usuario. */
export class ErrorCrud extends Error {
  constructor(
    message: string,
    readonly codigo: CodigoErrorCrud,
  ) {
    super(message);
    this.name = 'ErrorCrud';
  }
}

const ERROR_GENERICO = 'Ocurrió un error inesperado. Intenta de nuevo.';

/** Traduce cualquier error (local o HTTP) a un mensaje para el usuario. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorCrud) {
    return error.message;
  }
  if (error instanceof HttpErrorResponse) {
    // Si el API responde { "mensaje": "..." }, se muestra tal cual.
    const mensajeApi = (error.error as { mensaje?: unknown } | null)?.mensaje;
    if (typeof mensajeApi === 'string') {
      return mensajeApi;
    }
    switch (error.status) {
      case 0:
        return 'No fue posible conectar con el servidor.';
      case 400:
      case 422:
        return 'Los datos enviados no son válidos.';
      case 401:
      case 403:
        return 'No tienes permisos para realizar esta acción.';
      case 404:
        return 'El registro no existe o fue eliminado.';
      case 409:
        return 'Ya existe un registro con esos datos o está en uso por otros registros.';
    }
  }
  return ERROR_GENERICO;
}

/**
 * Siguiente consecutivo legible, p. ej. `siguienteConsecutivo('FAC', ['FAC-0007'])` → `'FAC-0008'` (rutas:
 * `siguienteConsecutivo('R', ['R-05'], 2)` → `'R-06'`). Igual que `Consecutivos.SiguienteAsync` del API.
 */
export function siguienteConsecutivo(prefijo: string, existentes: string[], digitos = 4): string {
  const maximo = existentes
    .filter((n) => n.startsWith(`${prefijo}-`))
    .map((n) => n.slice(prefijo.length + 1))
    .map((n) => (/^\d+$/.test(n) ? Number(n) : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefijo}-${String(maximo + 1).padStart(digitos, '0')}`;
}
