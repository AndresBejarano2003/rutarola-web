import { GRADOS, JORNADAS, ordenGrado, ordenJornada } from 'src/app/shared/catalogos/catalogos';
import { Entidad, EstadoRegistro } from 'src/app/shared/crud/crud';

/** Curso (grado) que ofrece un colegio, con su horario. */
export interface Curso {
  /** Id del grado en `GRADOS` (Jardín, Transición, 1° ... 11°). */
  grado: string;
  /** Jornada del curso (`JORNADAS`): un mismo grado puede ofrecerse en varias jornadas con distinto horario. */
  jornada: string;
  /** `HH:mm` */
  horaEntrada: string;
  /** `HH:mm` */
  horaSalida: string;
  estado: EstadoRegistro;
}

export interface Colegio extends Entidad {
  nit: string;
  razonSocial: string;
  direccion: string;
  telefono: string;
  /** Cursos parametrizados, ordenados de Jardín a Once. */
  cursos: Curso[];
  estado: EstadoRegistro;
}

export interface FiltrosColegio {
  /** Busca en razón social y NIT. */
  texto: string;
  estado: EstadoRegistro | '';
}

export const FILTROS_COLEGIO_VACIOS: FiltrosColegio = { texto: '', estado: '' };

/** Grado desde el que se generan los cursos con "Agregar cursos". */
export const GRADO_INICIAL = GRADOS[0].id;

/** Jornada que se propone al agregar cursos. */
export const JORNADA_INICIAL = JORNADAS[0].id;

/** Un curso se identifica por grado + jornada. */
export function claveCurso(curso: Pick<Curso, 'grado' | 'jornada'>): string {
  return `${curso.grado}|${curso.jornada}`;
}

/** Ordena por jornada (Mañana, Tarde, Única) y luego de Jardín a Once. */
export function ordenarCursos(cursos: Curso[]): Curso[] {
  return [...cursos].sort((a, b) => ordenJornada(a.jornada) - ordenJornada(b.jornada) || ordenGrado(a.grado) - ordenGrado(b.grado));
}

/**
 * Regla "Agregar cursos": agrega (o actualiza) los grados entre `desde` y `hasta` en la `jornada` con el horario
 * indicado. Con `desde === hasta` agrega un solo curso. Los cursos que ya existen en ese rango y jornada toman el nuevo
 * horario (conservan su estado); los de otras jornadas o fuera del rango no cambian.
 */
export function generarCursos(
  actuales: Curso[],
  hasta: string,
  horaEntrada: string,
  horaSalida: string,
  jornada: string = JORNADA_INICIAL,
  desde: string = GRADO_INICIAL,
): Curso[] {
  const inicio = Math.max(0, ordenGrado(desde));
  const fin = ordenGrado(hasta);
  const rango = GRADOS.slice(Math.min(inicio, fin), Math.max(inicio, fin) + 1).map((g) => g.id);
  const enRango = (c: Curso) => c.jornada === jornada && rango.includes(c.grado);
  const resultado = actuales.filter((c) => !enRango(c));
  for (const grado of rango) {
    const existente = actuales.find((c) => c.jornada === jornada && c.grado === grado);
    resultado.push({ grado, jornada, horaEntrada, horaSalida, estado: existente?.estado ?? 'ACTIVO' });
  }
  return ordenarCursos(resultado);
}

/** Texto corto de los cursos activos, p. ej. "Jardín – 11°" o "Jardín – 5° · Mañana, 6° – 11° · Tarde". */
export function rangoCursos(cursos: Curso[]): string {
  const activos = ordenarCursos(cursos.filter((c) => c.estado === 'ACTIVO'));
  if (!activos.length) return 'Sin cursos';
  const jornadas = [...new Set(activos.map((c) => c.jornada))];
  const rango = (lista: Curso[]) => {
    const primero = lista[0].grado;
    const ultimo = lista[lista.length - 1].grado;
    return primero === ultimo ? primero : `${primero} – ${ultimo}`;
  };
  if (jornadas.length === 1) return rango(activos);
  return jornadas.map((j) => `${rango(activos.filter((c) => c.jornada === j))} · ${j}`).join(', ');
}

/** Cursos activos de una jornada (los grados que puede tomar un estudiante de esa jornada). */
export function cursosDeJornada(cursos: Curso[], jornada: string): Curso[] {
  return ordenarCursos(cursos.filter((c) => c.estado === 'ACTIVO' && c.jornada === jornada));
}
