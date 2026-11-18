import { Entidad, EstadoRegistro } from 'src/app/shared/crud/crud';

/**
 * Vehículo + conductor (+ monitora) que cubren una ruta durante un periodo y, opcionalmente, en un horario: una ruta
 * puede tener varias asignaciones (p. ej. una semana un equipo y la siguiente otro, o dos equipos el mismo día en
 * horas distintas) mientras no se crucen (`seCruzan`).
 */
export interface Asignacion extends Entidad {
  rutaId: string;
  vehiculoId: string;
  /** Empleado de tipo CONDUCTOR. */
  conductorId: string;
  /** Empleado de tipo MONITORA (opcional). */
  monitoraId: string;
  /** `YYYY-MM-DD` */
  fechaInicio: string;
  /** `YYYY-MM-DD`; vacío = indefinida. */
  fechaFin: string;
  /** `HH:mm`; vacío (con `horaFin` vacía) = toda la jornada de la ruta. */
  horaInicio: string;
  /** `HH:mm`, posterior a `horaInicio`. */
  horaFin: string;
  estado: EstadoRegistro;
  observaciones: string;
}

export interface FiltrosAsignacion {
  rutaId: string;
  vehiculoId: string;
  /** Conductor o monitora. */
  empleadoId: string;
  estado: EstadoRegistro | '';
  /** `YYYY-MM-DD`: las que cubren ese día. */
  fecha?: string;
}

export const FILTROS_ASIGNACION_VACIOS: FiltrosAsignacion = { rutaId: '', vehiculoId: '', empleadoId: '', estado: '' };

type Periodo = Pick<Asignacion, 'fechaInicio' | 'fechaFin' | 'horaInicio' | 'horaFin'>;

/** La asignación cubre ese día (`YYYY-MM-DD`). */
export function cubreFecha(a: Pick<Asignacion, 'fechaInicio' | 'fechaFin'>, fecha: string): boolean {
  return a.fechaInicio <= fecha && (!a.fechaFin || a.fechaFin >= fecha);
}

export function fechasSeCruzan(a: Pick<Asignacion, 'fechaInicio' | 'fechaFin'>, b: Pick<Asignacion, 'fechaInicio' | 'fechaFin'>): boolean {
  return a.fechaInicio <= (b.fechaFin || '9999-12-31') && b.fechaInicio <= (a.fechaFin || '9999-12-31');
}

/**
 * Horario: si las dos tienen horas se comparan; si alguna no tiene, ocupa toda la jornada de su ruta y se cruza con
 * las de la misma jornada (`ReglasAsignacion.HorarioSeCruza` del API).
 */
export function horarioSeCruza(a: Periodo, jornadaA: string, b: Periodo, jornadaB: string): boolean {
  if (a.horaInicio && a.horaFin && b.horaInicio && b.horaFin) {
    return a.horaInicio < b.horaFin && b.horaInicio < a.horaFin;
  }
  return jornadaA === jornadaB;
}

/** Dos asignaciones activas se cruzan si se tocan en fechas y en horario. */
export function seCruzan(a: Periodo, jornadaA: string, b: Periodo, jornadaB: string): boolean {
  return fechasSeCruzan(a, b) && horarioSeCruza(a, jornadaA, b, jornadaB);
}

/** `06:00–09:30` o `''` sin horario. */
export function textoHorario(a: Pick<Asignacion, 'horaInicio' | 'horaFin'>): string {
  return a.horaInicio && a.horaFin ? `${a.horaInicio}–${a.horaFin}` : '';
}

/** `del 2026-11-02 al 2026-11-06, 06:00–09:30` (mensajes de cruce, como `ReglasAsignacion.Periodo`). */
export function textoPeriodo(a: Periodo): string {
  const fechas = a.fechaFin ? `del ${a.fechaInicio} al ${a.fechaFin}` : `desde el ${a.fechaInicio}`;
  const horario = textoHorario(a);
  return horario ? `${fechas}, ${horario}` : fechas;
}

/** Por hora de inicio (sin horario primero) y luego por fecha de inicio. */
export function ordenarPorHorario<T extends Periodo>(lista: T[]): T[] {
  // `?? ''`: registros locales guardados antes del horario no traen las horas.
  return [...lista].sort((a, b) => (a.horaInicio ?? '').localeCompare(b.horaInicio ?? '') || a.fechaInicio.localeCompare(b.fechaInicio));
}

/**
 * La asignación activa que cubre la ruta ese día; con varias (turnos), la del turno en curso a `hora` (`HH:mm`), o
 * la siguiente del día, o la primera (`ReglasAsignacion.Vigente`).
 */
export function asignacionVigente<T extends Periodo & Pick<Asignacion, 'rutaId' | 'estado'>>(
  asignaciones: T[],
  rutaId: string,
  fecha: string,
  hora?: string,
): T | undefined {
  const delDia = ordenarPorHorario(asignaciones.filter((a) => a.estado === 'ACTIVO' && a.rutaId === rutaId && cubreFecha(a, fecha)));
  if (delDia.length <= 1 || !hora) return delDia[0];
  return (
    delDia.find((a) => a.horaInicio && a.horaFin && a.horaInicio <= hora && hora < a.horaFin) ??
    delDia.find((a) => a.horaInicio && a.horaInicio > hora) ??
    delDia[0]
  );
}
