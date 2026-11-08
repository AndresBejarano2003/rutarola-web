import { EstadoCotizacion } from 'src/app/finanzas/cotizaciones/cotizacion';
import { MedioPago } from 'src/app/finanzas/recibos/recibo';
import { EstadoParada, MotivoAusencia, Trayecto, nombreAusencia } from 'src/app/ruta-del-dia/recorrido';
import { EstadoRegistro } from 'src/app/shared/crud/crud';

/**
 * Estado de cada mensualidad de una factura vigente:
 * - `PAGADA`: tiene recibo válido.
 * - `VENCIDA`: mes ya iniciado, sin recibo y pasó la fecha límite (en mora).
 * - `PENDIENTE`: mes ya iniciado, sin recibo y aún dentro del plazo.
 * - `PROGRAMADA`: mes futuro.
 */
export type EstadoCuota = 'PAGADA' | 'VENCIDA' | 'PENDIENTE' | 'PROGRAMADA';

export const ESTADOS_CUOTA: Record<EstadoCuota, { nombre: string; badge: string; icono: string }> = {
  PAGADA: { nombre: 'Pagada', badge: 'badge-soft badge-success', icono: 'fa-solid fa-circle-check' },
  VENCIDA: { nombre: 'Vencida', badge: 'badge-soft badge-error', icono: 'fa-solid fa-circle-exclamation' },
  PENDIENTE: { nombre: 'Por pagar', badge: 'badge-soft badge-warning', icono: 'fa-solid fa-clock' },
  PROGRAMADA: { nombre: 'Próxima', badge: 'bg-base-300 text-base-content', icono: 'fa-regular fa-calendar' },
};

export interface ReciboPortal {
  id: string;
  numero: string;
  numeroFactura: string;
  estudiante: string;
  /** Mes pagado, `YYYY-MM`. */
  periodo: string;
  fechaPago: string;
  valor: number;
  medioPago: MedioPago;
  referencia: string;
  /** ACTIVO = válido, INACTIVO = anulado. */
  estado: EstadoRegistro;
}

export interface CuotaPortal {
  periodo: string;
  valor: number;
  estado: EstadoCuota;
  /** `YYYY-MM-DD` */
  fechaLimite: string;
  /** Días desde la fecha límite (> 0 = en mora). Solo para cuotas sin pagar ya iniciadas. */
  diasMora: number;
  /** Recibo válido que la paga. */
  recibo: Pick<ReciboPortal, 'id' | 'numero' | 'fechaPago' | 'medioPago'> | null;
}

export interface FacturaPortal {
  id: string;
  numero: string;
  fechaEmision: string;
  estudianteId: string;
  estudiante: string;
  concepto: string;
  valorMensual: number;
  periodoInicio: string;
  periodoFin: string;
  /** Valor de todo el contrato (meses × valor mensual). */
  total: number;
  pagado: number;
  /** Suma de las cuotas vencidas. */
  vencido: number;
  /** ACTIVO = vigente, INACTIVO = anulada (sin cuotas por cobrar). */
  estado: EstadoRegistro;
  cuotas: CuotaPortal[];
}

/** Cómo va hoy el estudiante en su ruta (de la Ruta del día del conductor). */
export interface RecorridoHoy {
  /** Para ver el vehículo en el mapa mientras `enCurso`. */
  recorridoId: string;
  trayecto: Trayecto;
  enCurso: boolean;
  estado: EstadoParada;
  horaAbordo: string | null;
  horaEntrega: string | null;
  motivoAusencia: MotivoAusencia | '';
}

export interface TransporteEstudiante {
  ruta: string;
  jornada: string;
  sector: string;
  vehiculo: string;
  conductor: string;
  telefonoConductor: string;
  monitora: string;
  telefonoMonitora: string;
}

export interface EstudiantePortal {
  id: string;
  nombre: string;
  iniciales: string;
  grado: string;
  jornada: string;
  direccion: string;
  colegio: string;
  direccionColegio: string;
  /** Horario del curso en el colegio (`HH:mm`). */
  horario: { entrada: string; salida: string } | null;
  estado: EstadoRegistro;
  /** Ruta activa con su asignación vigente; `null` si no tiene ruta. */
  transporte: TransporteEstudiante | null;
  hoy: RecorridoHoy[];
}

export interface CotizacionPortal {
  id: string;
  numero: string;
  fecha: string;
  estudiantes: string[];
  valorPorEstudiante: number;
  valorTotal: number;
  estado: EstadoCotizacion;
}

export interface ProximoPago {
  numeroFactura: string;
  estudiante: string;
  periodo: string;
  valor: number;
  fechaLimite: string;
  estado: EstadoCuota;
}

export interface ResumenCuenta {
  /** Suma de cuotas vencidas (mora). */
  vencido: number;
  cuotasVencidas: number;
  /** Cuotas del mes ya iniciadas y aún en plazo. */
  porPagar: number;
  /** La cuota sin pagar más próxima a vencer (primero las vencidas). */
  proximoPago: ProximoPago | null;
  /** Recibos válidos con fecha de pago en el año actual. */
  pagadoAnio: number;
  pagosAnio: number;
}

/** Todo lo que ve el acudiente autenticado (`GET /portal`). */
export interface PortalAcudiente {
  acudiente: { nombre: string; telefono: string; correo: string; direccion: string };
  estudiantes: EstudiantePortal[];
  facturas: FacturaPortal[];
  recibos: ReciboPortal[];
  cotizaciones: CotizacionPortal[];
  resumen: ResumenCuenta;
}

export const RESUMEN_VACIO: ResumenCuenta = { vencido: 0, cuotasVencidas: 0, porPagar: 0, proximoPago: null, pagadoAnio: 0, pagosAnio: 0 };

const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '');

/** Frase y color del estado de hoy de un estudiante en un trayecto (lo que ve el acudiente). */
export function situacionRecorrido(
  r: RecorridoHoy | undefined,
  trayecto: Trayecto,
): { texto: string; clase: string; icono: string } {
  const nombre = trayecto === 'RECOGIDA' ? 'Recogida' : 'Entrega';
  if (!r) return { texto: `${nombre}: aún no inicia`, clase: 'text-base-content/70', icono: 'fa-regular fa-clock' };
  switch (r.estado) {
    case 'PENDIENTE':
      return r.enCurso
        ? { texto: `${nombre}: la ruta va en camino`, clase: 'text-info', icono: 'fa-solid fa-route' }
        : { texto: `${nombre}: sin registrar`, clase: 'text-base-content/70', icono: 'fa-regular fa-clock' };
    case 'A_BORDO':
      return { texto: `A bordo desde ${hora(r.horaAbordo)}`, clase: 'text-info', icono: 'fa-solid fa-bus' };
    case 'ENTREGADO':
      return {
        texto: `${trayecto === 'RECOGIDA' ? 'Entregado en el colegio' : 'Entregado en casa'} ${hora(r.horaEntrega)}`,
        clase: 'text-success',
        icono: 'fa-solid fa-circle-check',
      };
    case 'AUSENTE':
      return { texto: `${nombre}: ${nombreAusencia(r.motivoAusencia, trayecto).toLowerCase()}`, clase: 'text-warning', icono: 'fa-solid fa-user-slash' };
  }
}
