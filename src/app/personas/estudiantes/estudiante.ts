import { Entidad, EstadoRegistro } from 'src/app/shared/crud/crud';
import { DatosPersona } from '../compartido/persona';

export interface Estudiante extends Entidad, DatosPersona {
  /** `YYYY-MM-DD` */
  fechaNacimiento: string;
  direccion: string;
  acudienteId: string;
  colegioId: string;
  grado: string;
  jornada: string;
  estado: EstadoRegistro;
  observaciones: string;
}

export interface FiltrosEstudiante {
  /** Busca en nombres, apellidos y número de documento. */
  texto: string;
  acudienteId: string;
  colegioId: string;
  grado: string;
  /** Solo los de esa jornada (p. ej. los estudiantes que se pueden agregar a una ruta). */
  jornada: string;
  estado: EstadoRegistro | '';
}

export const FILTROS_ESTUDIANTE_VACIOS: FiltrosEstudiante = {
  texto: '',
  acudienteId: '',
  colegioId: '',
  grado: '',
  jornada: '',
  estado: '',
};

/** Edad en años cumplidos a partir de `YYYY-MM-DD`. */
export function calcularEdad(fechaNacimiento: string, hoy = new Date()): number | null {
  if (!fechaNacimiento) {
    return null;
  }
  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number);
  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) {
    edad--;
  }
  return edad;
}
