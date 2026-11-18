import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { Entidad, EstadoRegistro } from 'src/app/shared/crud/crud';
import { AplicacionRecibo, PagoMes } from '../cuotas';

export type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'NEQUI' | 'DAVIPLATA' | 'TARJETA';

/**
 * Pago de una factura. Puede pagar o abonar VARIOS meses: `aplicacion` MESES (los `periodos` elegidos) o SALDO (abono
 * al saldo de la factura, los meses más antiguos primero). `meses` dice cuánto se aplicó a cada mes (lo calcula el
 * servidor); un pago parcial deja el mes pendiente con su saldo.
 */
export interface Recibo extends Entidad {
  /** Consecutivo generado al crear (`REC-0001`). */
  numero: string;
  facturaId: string;
  /** Datos de la factura al momento del pago. */
  numeroFactura: string;
  nombreAcudiente: string;
  nombreEstudiante: string;
  /** Primer mes al que aplica, `YYYY-MM` (compatibilidad: el único mes de los recibos anteriores). */
  periodo: string;
  aplicacion?: AplicacionRecibo;
  /** Meses elegidos (`aplicacion` MESES). */
  periodos?: string[];
  /** Valor aplicado a cada mes (solo lectura). */
  meses?: PagoMes[];
  /** `YYYY-MM-DD` */
  fechaPago: string;
  valor: number;
  medioPago: MedioPago;
  /** Número de transacción o comprobante. */
  referencia: string;
  /** ACTIVO = válido, INACTIVO = anulado. */
  estado: EstadoRegistro;
  observaciones: string;
}

export interface FiltrosRecibo {
  /** Busca en número de recibo y factura, acudiente, estudiante y referencia. */
  texto: string;
  facturaId: string;
  medioPago: MedioPago | '';
  estado: EstadoRegistro | '';
  /** Fecha de pago desde / hasta (`YYYY-MM-DD`). */
  desde: string;
  hasta: string;
}

export const FILTROS_RECIBO_VACIOS: FiltrosRecibo = { texto: '', facturaId: '', medioPago: '', estado: '', desde: '', hasta: '' };

/** Meses del recibo (los antiguos sin detalle: su periodo con todo el valor). */
export function mesesRecibo(r: Pick<Recibo, 'periodo' | 'valor' | 'meses'>): PagoMes[] {
  return r.meses?.length ? r.meses : r.periodo ? [{ periodo: r.periodo, valor: r.valor }] : [];
}

export const MEDIOS_PAGO: { id: MedioPago; nombre: string; icono: string }[] = [
  { id: 'EFECTIVO', nombre: 'Efectivo', icono: 'fa-solid fa-money-bill-wave' },
  { id: 'TRANSFERENCIA', nombre: 'Transferencia bancaria', icono: 'fa-solid fa-building-columns' },
  { id: 'NEQUI', nombre: 'Nequi', icono: 'fa-solid fa-mobile-screen' },
  { id: 'DAVIPLATA', nombre: 'Daviplata', icono: 'fa-solid fa-mobile-screen' },
  { id: 'TARJETA', nombre: 'Tarjeta débito/crédito', icono: 'fa-solid fa-credit-card' },
];

export const ESTADOS_RECIBO: OpcionCatalogo[] = [
  { id: 'ACTIVO', nombre: 'Válido' },
  { id: 'INACTIVO', nombre: 'Anulado' },
];
