import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { Entidad, EstadoRegistro } from 'src/app/shared/crud/crud';
import { mesesCobrables } from '../cuotas';

/**
 * Factura de contratación del servicio: un estudiante, su acudiente y el
 * valor MENSUAL contratado durante un periodo (p. ej. feb–nov). Los pagos
 * de cada mes se registran como recibos.
 */
export interface Factura extends Entidad {
  /** Consecutivo generado al crear (`FAC-0001`). */
  numero: string;
  /** `YYYY-MM-DD` */
  fechaEmision: string;
  acudienteId: string;
  estudianteId: string;
  /** Nombres al momento de emitir (la factura conserva los datos con que se expidió). */
  nombreAcudiente: string;
  nombreEstudiante: string;
  /** Valor mensual de la contratación (COP). */
  valorContratacion: number;
  /** Primer y último mes del servicio, `YYYY-MM`. */
  periodoInicio: string;
  periodoFin: string;
  concepto: string;
  /** ACTIVO = vigente, INACTIVO = anulada. */
  estado: EstadoRegistro;
  observaciones: string;
  /**
   * Retiro del estudiante o del acudiente: primer mes que YA NO se cobra (`''` = sin retiro). Lo pone
   * `FacturasRepositorio.retiro` (o el servidor al inactivar al estudiante/acudiente), no el formulario.
   */
  periodoRetiro?: string;
  motivoRetiro?: string;
  /** Cotización aprobada de la que salió (`''` si se creó a mano). Solo lectura. */
  cotizacionId?: string;
  numeroCotizacion?: string;
}

/** Mes de la factura con lo pagado y el saldo (`GET /facturas/{id}/cuotas`). */
export interface CuotaFactura {
  periodo: string;
  valor: number;
  pagado: number;
  saldo: number;
  /** `YYYY-MM-DD` */
  fechaLimite: string;
  estado: 'PAGADA' | 'VENCIDA' | 'PENDIENTE' | 'PROGRAMADA';
}

export interface FiltrosFactura {
  /** Busca en número, acudiente y estudiante. */
  texto: string;
  acudienteId: string;
  estudianteId: string;
  estado: EstadoRegistro | '';
}

export const FILTROS_FACTURA_VACIOS: FiltrosFactura = { texto: '', acudienteId: '', estudianteId: '', estado: '' };

export const ESTADOS_FACTURA: OpcionCatalogo[] = [
  { id: 'ACTIVO', nombre: 'Vigente' },
  { id: 'INACTIVO', nombre: 'Anulada' },
];

/** Meses que se cobran (sin los meses desde el retiro). */
export function mesesFactura(f: Pick<Factura, 'periodoInicio' | 'periodoFin' | 'periodoRetiro'>): string[] {
  return mesesCobrables(f);
}

export function totalFactura(f: Pick<Factura, 'periodoInicio' | 'periodoFin' | 'periodoRetiro' | 'valorContratacion'>): number {
  return mesesFactura(f).length * f.valorContratacion;
}

export function etiquetaFactura(f: Pick<Factura, 'numero' | 'nombreEstudiante'>): string {
  return `${f.numero} · ${f.nombreEstudiante}`;
}
