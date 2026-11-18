import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { Entidad } from 'src/app/shared/crud/crud';
import { nombrePeriodo, periodosEntre } from 'src/app/shared/fechas/fechas';
import { textoPesos } from '../cuotas';

export type EstadoCotizacion = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

/**
 * Estudiante incluido en la cotización: registrado (`estudianteId`) o solo nombre (cliente nuevo), con su colegio
 * (registrado `colegioId`, o escrito en `nombreColegio`) y su valor MENSUAL (cada estudiante puede tener uno distinto).
 */
export interface EstudianteCotizado {
  estudianteId: string | null;
  nombre: string;
  colegioId: string | null;
  nombreColegio: string;
  valor: number;
}

export interface Cotizacion extends Entidad {
  /** Consecutivo generado al crear (`COT-0001`). */
  numero: string;
  /** `YYYY-MM-DD` */
  fecha: string;
  /** ¿El acudiente y los estudiantes ya existen en el sistema? */
  registrados: boolean;
  /** Solo si `registrados`. */
  acudienteId: string | null;
  nombreAcudiente: string;
  telefonoAcudiente: string;
  /** Correo del acudiente registrado (solo lectura, para enviarla por correo). */
  correoAcudiente?: string;
  estudiantes: EstudianteCotizado[];
  /** Meses del servicio `YYYY-MM` (como en la factura). */
  periodoInicio: string;
  periodoFin: string;
  /** Calculados por el servidor: suma de los estudiantes, cantidad de meses y mensual × meses. */
  valorMensual: number;
  meses: number;
  valorTotal: number;
  estado: EstadoCotizacion;
  observaciones: string;
  /** Facturas que se generaron al aprobarla (vacía = aún no se facturó; con facturas queda de solo lectura). */
  facturas: OpcionCatalogo[];
}

export interface FiltrosCotizacion {
  /** Busca en número, acudiente, estudiantes y colegios. */
  texto: string;
  estado: EstadoCotizacion | '';
  /** Fecha desde / hasta (`YYYY-MM-DD`). */
  desde: string;
  hasta: string;
}

export const FILTROS_COTIZACION_VACIOS: FiltrosCotizacion = { texto: '', estado: '', desde: '', hasta: '' };

export const ESTADOS_COTIZACION: { id: EstadoCotizacion; nombre: string; clase: string }[] = [
  { id: 'PENDIENTE', nombre: 'Pendiente', clase: 'badge-warning' },
  { id: 'APROBADA', nombre: 'Aprobada', clase: 'badge-success' },
  { id: 'RECHAZADA', nombre: 'Rechazada', clase: 'badge-error' },
];

/** Valores calculados (los mismos que recalcula el servidor). */
export function calcularValores(
  estudiantes: readonly Pick<EstudianteCotizado, 'valor'>[],
  periodoInicio: string,
  periodoFin: string,
): { valorMensual: number; meses: number; valorTotal: number } {
  const valorMensual = estudiantes.reduce((s, e) => s + Math.max(0, e.valor || 0), 0);
  const meses = periodoInicio && periodoFin && periodoFin >= periodoInicio ? periodosEntre(periodoInicio, periodoFin).length : 0;
  return { valorMensual, meses, valorTotal: valorMensual * meses };
}

export function facturada(c: Pick<Cotizacion, 'facturas'>): boolean {
  return (c.facturas?.length ?? 0) > 0;
}

/** Qué falta para poder convertirla en facturas (`null` = se puede). */
export function motivoNoFacturar(c: Cotizacion): string | null {
  if (facturada(c)) return `La cotización ${c.numero} ya se convirtió en facturas.`;
  if (c.estado === 'RECHAZADA') return 'La cotización está rechazada. Cámbiala a Pendiente o Aprobada para facturarla.';
  if (!c.acudienteId) {
    return 'Para facturar, registra al acudiente y a sus estudiantes y edita la cotización eligiéndolos (cliente registrado).';
  }
  const sinRegistro = c.estudiantes.filter((e) => !e.estudianteId).map((e) => e.nombre);
  if (sinRegistro.length) return `Registra a ${sinRegistro.join(', ')} y edita la cotización eligiéndolos para poder facturar.`;
  return null;
}

/** Mensaje para WhatsApp y correo. */
export function textoCotizacion(c: Cotizacion, empresa = ''): string {
  const lineas = c.estudiantes.map((e) => `• ${e.nombre}${e.nombreColegio ? ` (${e.nombreColegio})` : ''}: ${textoPesos(e.valor)} mensuales`);
  const meses = c.meses || calcularValores(c.estudiantes, c.periodoInicio, c.periodoFin).meses;
  return [
    `Hola ${c.nombreAcudiente}, ${empresa ? `en ${empresa} ` : ''}te compartimos la cotización ${c.numero} del servicio de transporte escolar:`,
    '',
    ...lineas,
    '',
    `Servicio de ${nombrePeriodo(c.periodoInicio, true)} a ${nombrePeriodo(c.periodoFin, true)} (${meses} ${meses === 1 ? 'mes' : 'meses'}).`,
    `Valor mensual: ${textoPesos(c.valorMensual)} · Total: ${textoPesos(c.valorTotal)}.`,
    ...(c.observaciones ? ['', c.observaciones] : []),
  ].join('\n');
}

/** Teléfono colombiano para wa.me (`57` + 10 dígitos); `''` si no sirve. */
export function telefonoWhatsapp(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length === 10) return `57${digitos}`;
  if (digitos.length === 12 && digitos.startsWith('57')) return digitos;
  return '';
}

export function enlaceWhatsapp(c: Cotizacion, empresa = ''): string {
  const numero = telefonoWhatsapp(c.telefonoAcudiente);
  return `https://wa.me/${numero}?text=${encodeURIComponent(textoCotizacion(c, empresa))}`;
}

export function enlaceCorreo(c: Cotizacion, empresa = ''): string {
  const asunto = `Cotización ${c.numero} de transporte escolar`;
  return `mailto:${encodeURIComponent(c.correoAcudiente ?? '')}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(textoCotizacion(c, empresa))}`;
}
