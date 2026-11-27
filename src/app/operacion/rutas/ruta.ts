import { Entidad, EstadoRegistro } from 'src/app/shared/crud/crud';

export interface Ruta extends Entidad {
  /** Consecutivo que asigna el sistema al crear (`R-01`, `R-02`…); no se edita. */
  codigo: string;
  nombre: string;
  /**
   * Colegios que atiende, todos de su jornada, en el orden en que se agregaron (una ruta puede llevar
   * estudiantes de varios colegios). Al menos uno.
   */
  colegioIds: string[];
  jornada: string;
  /** Barrios o sectores que recorre. */
  sector: string;
  /**
   * Estudiantes de esos colegios y de la jornada, EN EL ORDEN DE RECOGIDA: es el orden con el que arranca cada
   * recorrido (la entrega lo recorre al revés). Si el administrador lo cambia, los recorridos en curso reordenan
   * lo que les falta.
   */
  estudianteIds: string[];
  estado: EstadoRegistro;
  observaciones: string;
}

export interface FiltrosRuta {
  /** Busca en código, nombre y sector. */
  texto: string;
  /** Rutas que atienden este colegio (entre otros). */
  colegioId: string;
  jornada: string;
  estado: EstadoRegistro | '';
  /** Rutas que llevan a este estudiante. */
  estudianteId: string;
}

export const FILTROS_RUTA_VACIOS: FiltrosRuta = { texto: '', colegioId: '', jornada: '', estado: '', estudianteId: '' };

/** Prefijo del consecutivo de rutas (`Consecutivos` del API, `ServicioRutas.PrefijoCodigo`). */
export const PREFIJO_CODIGO_RUTA = 'R';

export function etiquetaRuta(r: Pick<Ruta, 'codigo' | 'nombre'>): string {
  return `${r.codigo} · ${r.nombre}`;
}

/** Datos guardados antes de que una ruta tuviera varios colegios (`colegioId` → `colegioIds`). */
export function conColegios(r: Ruta & { colegioId?: string }): Ruta {
  if (Array.isArray(r.colegioIds)) return r;
  const { colegioId, ...resto } = r;
  return { ...resto, colegioIds: colegioId ? [colegioId] : [] };
}
