import { Entidad, EstadoRegistro } from 'src/app/shared/crud/crud';

export interface Ruta extends Entidad {
  /** Consecutivo que asigna el sistema al crear (`R-01`, `R-02`…); no se edita. */
  codigo: string;
  nombre: string;
  colegioId: string;
  jornada: string;
  /** Barrios o sectores que recorre. */
  sector: string;
  /** Estudiantes (del mismo colegio) que transporta. */
  estudianteIds: string[];
  estado: EstadoRegistro;
  observaciones: string;
}

export interface FiltrosRuta {
  /** Busca en código, nombre y sector. */
  texto: string;
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
