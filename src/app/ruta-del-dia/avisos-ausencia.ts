import { ErrorCrud } from 'src/app/shared/crud/crud';
import { MotivoAusencia, Trayecto } from './recorrido';

/**
 * Aviso del acudiente desde su portal: su estudiante no viaja en la ruta una fecha (`avisos_ausencia`).
 * - `NO_ASISTE`: no va al colegio → aplica a la recogida y a la entrega (`trayecto` `''`).
 * - `POR_SU_CUENTA`: sí va al colegio, pero no usa la ruta en un trayecto (o en los dos, `''`).
 * El conductor o la monitora lo ven en la parada ("El acudiente avisó…"), llaman o escriben si hace falta y lo
 * CONFIRMAN al marcarlo AUSENTE; "Deshacer" lo deja otra vez sin confirmar. El administrador los ve en
 * Operación › Asignaciones. Igual a `AvisoAusenciaDto` del API.
 */
export interface AvisoAusencia {
  id: string;
  estudianteId: string;
  estudiante: string;
  /** `YYYY-MM-DD` */
  fecha: string;
  /** `''` = recogida y entrega. */
  trayecto: Trayecto | '';
  motivo: MotivoAusencia;
  nota: string;
  acudiente: string;
  telefonoAcudiente: string;
  ruta: string;
  confirmado: boolean;
  confirmadoPor: string;
  fechaConfirmacion: string | null;
  fechaCreacion: string;
}

/** El aviso tal como lo ve el personal en la parada (`AvisoParadaDto`). `fecha` = cuándo avisó (ISO). */
export interface AvisoParada {
  id: string;
  motivo: MotivoAusencia;
  nota: string;
  acudiente: string;
  fecha: string;
  confirmado: boolean;
  confirmadoPor: string;
}

/** `POST /portal/avisos`. `trayecto` null = ambos (siempre null con NO_ASISTE). */
export interface SolicitudAvisoAusencia {
  estudianteId: string;
  fecha: string;
  trayecto: Trayecto | null;
  motivo: MotivoAusencia;
  nota: string;
}

/** Se avisa desde hoy y hasta estos días adelante (`ServicioAvisosAusencia.DiasMaximos`). */
export const DIAS_MAXIMOS_AVISO = 30;

export function avisoAplica(a: Pick<AvisoAusencia, 'estudianteId' | 'fecha' | 'trayecto'>, estudianteId: string, fecha: string, trayecto: Trayecto): boolean {
  return a.estudianteId === estudianteId && a.fecha === fecha && (!a.trayecto || a.trayecto === trayecto);
}

/** "No va al colegio", "No usa la ruta en la recogida"… */
export function textoAviso(a: Pick<AvisoAusencia, 'motivo' | 'trayecto'>): string {
  if (a.motivo === 'NO_ASISTE') return 'No va al colegio';
  if (a.trayecto === 'RECOGIDA') return 'Va al colegio, pero no usa la ruta en la recogida';
  if (a.trayecto === 'ENTREGA') return 'No regresa en la ruta (entrega)';
  return 'Va al colegio, pero no usa la ruta (recogida ni entrega)';
}

/** Motivo con que se marca AUSENTE al confirmar: en la entrega "No asiste" se registra como "No viaja". */
export function motivoAlConfirmar(a: Pick<AvisoParada, 'motivo'>, trayecto: Trayecto): MotivoAusencia {
  return a.motivo === 'NO_ASISTE' && trayecto === 'RECOGIDA' ? 'NO_ASISTE' : 'POR_SU_CUENTA';
}

export function aParada(a: AvisoAusencia): AvisoParada {
  return {
    id: a.id,
    motivo: a.motivo,
    nota: a.nota,
    acudiente: a.acudiente,
    fecha: a.fechaCreacion,
    confirmado: a.confirmado,
    confirmadoPor: a.confirmadoPor,
  };
}

// --- Modo local (temporal) -----------------------------------------------------------------------

/** `localStorage` de los avisos (portal, Ruta del día y Asignaciones lo comparten). */
export const CLAVE_AVISOS_AUSENCIA = 'rutarola.avisos-ausencia';

export type AvisoGuardado = AvisoAusencia & { acudienteId: string; confirmadoPorId: string };

export function leerAvisos(): AvisoGuardado[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_AVISOS_AUSENCIA) ?? '[]') as AvisoGuardado[];
  } catch {
    return [];
  }
}

export function escribirAvisos(avisos: AvisoGuardado[]): void {
  try {
    localStorage.setItem(CLAVE_AVISOS_AUSENCIA, JSON.stringify(avisos));
  } catch {
    throw new ErrorCrud('No hay espacio en el almacenamiento temporal del navegador.', 'SIN_ESPACIO');
  }
}

export function publico({ acudienteId: _a, confirmadoPorId: _c, ...aviso }: AvisoGuardado): AvisoAusencia {
  return aviso;
}

export function ordenarAvisos<T extends Pick<AvisoAusencia, 'fecha' | 'estudiante'>>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.estudiante.localeCompare(b.estudiante));
}
