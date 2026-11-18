import { MotivoAusencia, Trayecto } from 'src/app/ruta-del-dia/recorrido';
import { NivelNotificacion } from 'src/app/inicio/notificaciones/notificacion-sistema';

/** Espejo de `Cronograma.cs` (`GET /cronograma?desde=&hasta=`, `GET /cronograma/dia?fecha=`). */
export type TipoEventoCronograma = 'DOCUMENTO' | 'LICENCIA' | 'PAGO' | 'CONTRATO' | 'FIN_ASIGNACION';

export interface EventoCronograma {
  tipo: TipoEventoCronograma;
  /** CRITICA = vencido, ADVERTENCIA = por atender, INFORMATIVA. */
  nivel: NivelNotificacion;
  titulo: string;
  detalle: string;
  enlace: string;
}

export interface DiaCronograma {
  /** `YYYY-MM-DD` */
  fecha: string;
  /** Lunes a viernes. */
  habil: boolean;
  /** Rutas programadas (activas con asignación vigente en día hábil) o que tuvieron recorrido. */
  rutas: number;
  finalizados: number;
  enCurso: number;
  /** Avisos de ausencia de los acudientes para ese día. */
  ausencias: number;
  eventos: EventoCronograma[];
}

export interface Cronograma {
  desde: string;
  hasta: string;
  dias: DiaCronograma[];
}

export type EstadoTrayectoCronograma = 'PROGRAMADO' | 'EN_CURSO' | 'FINALIZADO' | 'SIN_REGISTRO';

export interface TrayectoCronograma {
  trayecto: Trayecto;
  estado: EstadoTrayectoCronograma;
  /** `''` sin recorrido. */
  recorridoId: string;
  /** `HH:mm` o `''`. */
  horaInicio: string;
  horaFin: string;
}

export interface RutaCronograma {
  rutaId: string;
  codigo: string;
  nombre: string;
  jornada: string;
  colegio: string;
  /** Placa (`''` sin asignación ese día). */
  vehiculo: string;
  conductor: string;
  monitora: string;
  estudiantes: number;
  ausencias: number;
  trayectos: TrayectoCronograma[];
}

export interface AusenciaCronograma {
  id: string;
  estudiante: string;
  /** Códigos de las rutas del estudiante. */
  ruta: string;
  /** `''` = recogida y entrega. */
  trayecto: Trayecto | '';
  motivo: MotivoAusencia;
  nota: string;
  acudiente: string;
  /** `''` sin confirmar. */
  confirmadoPor: string;
}

export interface DetalleDiaCronograma {
  fecha: string;
  habil: boolean;
  rutas: RutaCronograma[];
  ausencias: AusenciaCronograma[];
  eventos: EventoCronograma[];
}

/** Máximo de días por consulta (un año y algo). */
export const DIAS_MAXIMOS_CRONOGRAMA = 400;

export const ESTADOS_TRAYECTO: Record<EstadoTrayectoCronograma, { nombre: string; badge: string; icono: string }> = {
  PROGRAMADO: { nombre: 'Programado', badge: 'bg-base-300', icono: 'fa-regular fa-clock' },
  EN_CURSO: { nombre: 'En curso', badge: 'badge-info', icono: 'fa-solid fa-bus' },
  FINALIZADO: { nombre: 'Finalizado', badge: 'badge-success', icono: 'fa-solid fa-circle-check' },
  SIN_REGISTRO: { nombre: 'Sin registro', badge: 'badge-warning', icono: 'fa-solid fa-circle-question' },
};

export const ICONOS_EVENTO: Record<TipoEventoCronograma, string> = {
  DOCUMENTO: 'fa-solid fa-file-shield',
  LICENCIA: 'fa-solid fa-id-card',
  PAGO: 'fa-solid fa-money-bill-wave',
  CONTRATO: 'fa-solid fa-file-signature',
  FIN_ASIGNACION: 'fa-solid fa-route',
};

export type VistaCronograma = 'SEMANA' | 'MES' | 'ANIO';

const aFecha = (f: string) => new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)));
const aTexto = (d: Date) => d.toISOString().slice(0, 10);

export function sumarDiasCronograma(fecha: string, dias: number): string {
  const d = aFecha(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aTexto(d);
}

/** 0 = lunes … 6 = domingo. */
export function diaSemana(fecha: string): number {
  return (aFecha(fecha).getUTCDay() + 6) % 7;
}

export function esHabil(fecha: string): boolean {
  return diaSemana(fecha) < 5;
}

/** Rango de la vista que contiene `fecha`: semana lunes–domingo, mes calendario o año. */
export function rangoVista(vista: VistaCronograma, fecha: string): { desde: string; hasta: string } {
  if (vista === 'SEMANA') {
    const desde = sumarDiasCronograma(fecha, -diaSemana(fecha));
    return { desde, hasta: sumarDiasCronograma(desde, 6) };
  }
  const y = +fecha.slice(0, 4);
  if (vista === 'ANIO') return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
  const m = +fecha.slice(5, 7);
  return { desde: `${fecha.slice(0, 7)}-01`, hasta: aTexto(new Date(Date.UTC(y, m, 0))) };
}

/** La misma fecha en la vista anterior (−1) o siguiente (+1). */
export function moverVista(vista: VistaCronograma, fecha: string, paso: -1 | 1): string {
  if (vista === 'SEMANA') return sumarDiasCronograma(fecha, 7 * paso);
  const d = aFecha(fecha);
  if (vista === 'ANIO') return `${d.getUTCFullYear() + paso}-01-01`;
  return aTexto(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + paso, 1)));
}

/** Semanas (lunes a domingo) que cubren el mes de `desde`; `null` = día de otro mes. */
export function semanasDelMes(desde: string): (string | null)[][] {
  const { hasta } = rangoVista('MES', desde);
  const celdas: (string | null)[] = Array.from({ length: diaSemana(desde) }, () => null);
  for (let d = desde; d <= hasta; d = sumarDiasCronograma(d, 1)) celdas.push(d);
  while (celdas.length % 7) celdas.push(null);
  return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
}

/** El nivel más alto de los eventos del día (para el color del punto). */
export function nivelDelDia(d: Pick<DiaCronograma, 'eventos'>): NivelNotificacion | null {
  const orden: NivelNotificacion[] = ['CRITICA', 'ADVERTENCIA', 'INFORMATIVA', 'EXITO'];
  return orden.find((n) => d.eventos.some((e) => e.nivel === n)) ?? null;
}
