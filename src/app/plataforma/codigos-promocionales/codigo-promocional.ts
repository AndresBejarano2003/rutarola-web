import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { Entidad, ErrorCrud, EstadoRegistro } from 'src/app/shared/crud/crud';
import { fechaCorta, fechaIso } from 'src/app/shared/fechas/fechas';
import type { PeriodoPago, Plan, PlanSuscripcion } from 'src/app/sistema/membresias/suscripcion';

/**
 * Códigos promocionales (contrato: `Application/Suscripciones/CodigosPromocionales.cs`). Los crea la plataforma;
 * la empresa los escribe al pagar. El descuento es SOLO sobre el primer mes que se factura (en el anual, una de
 * sus mensualidades).
 */
export type TipoDescuento = 'PORCENTAJE' | 'VALOR_FIJO';
/** TODAS las empresas, solo las EMPRESAS elegidas o la PRIMERA_COMPRA (empresas que nunca han pagado un plan). */
export type AlcanceCodigo = 'TODAS' | 'EMPRESAS' | 'PRIMERA_COMPRA';
export type VigenciaCodigo = 'PROGRAMADO' | 'VIGENTE' | 'VENCIDO';

export interface CodigoPromocional extends Entidad {
  /** Mayúsculas, único: letras, números y guiones (4–30). Vacío al crear = lo genera el sistema (con `prefijo`). */
  codigo: string;
  /** Solo al enviar: prefijo del código generado (hasta 12 letras o números). */
  prefijo?: string;
  descripcion: string;
  tipoDescuento: TipoDescuento;
  /** Porcentaje (1–100) o pesos. */
  valor: number;
  /** `YYYY-MM-DD` (Colombia), ambas incluidas. */
  fechaInicio: string;
  fechaFin: string;
  alcance: AlcanceCodigo;
  /** Vacío = todos los planes de pago. */
  planes: PlanSuscripcion[];
  /** `''` = mensual y anual. */
  periodo: PeriodoPago | '';
  /** `null` = sin límite. */
  usosMaximos: number | null;
  usosPorEmpresa: number;
  estado: EstadoRegistro;
  /** Solo con alcance EMPRESAS. */
  empresaIds: string[];
  // Solo lectura (los calcula el servidor):
  empresas?: OpcionCatalogo[];
  usos?: number;
  vigencia?: VigenciaCodigo;
}

export interface FiltrosCodigoPromocional {
  texto: string;
  estado: EstadoRegistro | '';
  vigencia: VigenciaCodigo | '';
}

export const FILTROS_CODIGO_VACIOS: FiltrosCodigoPromocional = { texto: '', estado: '', vigencia: '' };

/** Un uso del código (pago aprobado o plan activado a mano por la plataforma: `referencia` vacía). */
export interface UsoCodigo {
  id: string;
  empresaId: string;
  empresa: string;
  plan: PlanSuscripcion;
  periodo: PeriodoPago;
  /** Pesos. */
  descuento: number;
  referencia: string;
  fecha: string;
}

/** El código aplica: precio del periodo, descuento del primer mes y total a pagar (pesos). */
export interface ValidacionCodigo {
  codigo: string;
  descripcion: string;
  tipoDescuento: TipoDescuento;
  valor: number;
  plan: PlanSuscripcion;
  periodo: PeriodoPago;
  precio: number;
  descuento: number;
  total: number;
}

export const PATRON_CODIGO = /^[A-Z0-9-]{4,30}$/;
export const PATRON_PREFIJO = /^[A-Z0-9]{0,12}$/;
/** Sin 0/O ni 1/I/L para dictarlo y escribirlo sin confundirse (igual que `ReglasCodigoPromocional.Generar`). */
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código aleatorio: `PREFIJO-XXXXXXXX` o `XXXX-XXXX` (el API lo genera igual cuando el código llega vacío). */
export function generarCodigo(prefijo = ''): string {
  const bytes = crypto.getRandomValues(new Uint32Array(8));
  const azar = [...bytes].map((b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
  const p = normalizarCodigo(prefijo);
  return p ? `${p}-${azar}` : `${azar.slice(0, 4)}-${azar.slice(4)}`;
}

export const TIPOS_DESCUENTO: { id: TipoDescuento; nombre: string; descripcion: string }[] = [
  { id: 'PORCENTAJE', nombre: 'Porcentaje', descripcion: '% del valor de un mes' },
  { id: 'VALOR_FIJO', nombre: 'Valor fijo', descripcion: 'Pesos, máximo un mes' },
];

export const ALCANCES_CODIGO: { id: AlcanceCodigo; nombre: string; descripcion: string }[] = [
  { id: 'TODAS', nombre: 'Todas las empresas', descripcion: 'Cualquier empresa que lo escriba' },
  { id: 'EMPRESAS', nombre: 'Empresas elegidas', descripcion: 'Solo las que selecciones' },
  { id: 'PRIMERA_COMPRA', nombre: 'Primera compra', descripcion: 'Empresas que nunca han pagado' },
];

export const VIGENCIAS_CODIGO: { id: VigenciaCodigo; nombre: string; badge: string }[] = [
  { id: 'VIGENTE', nombre: 'Vigente', badge: 'badge-success' },
  { id: 'PROGRAMADO', nombre: 'Programado', badge: 'badge-info' },
  { id: 'VENCIDO', nombre: 'Vencido', badge: 'bg-base-300' },
];

export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

export function vigenciaDe(inicio: string, fin: string, hoy = fechaIso()): VigenciaCodigo {
  return hoy < inicio ? 'PROGRAMADO' : hoy > fin ? 'VENCIDO' : 'VIGENTE';
}

/** Descuento en pesos: SOLO sobre un mes del plan (también en el anual) y nunca mayor que el total. */
export function descuentoCodigo(tipo: TipoDescuento, valor: number, precioMensual: number, total: number): number {
  const descuento =
    tipo === 'PORCENTAJE' ? Math.round((precioMensual * Math.min(100, Math.max(0, valor))) / 100) : Math.min(Math.max(0, Math.round(valor)), precioMensual);
  return Math.min(descuento, total);
}

/** "20 % del primer mes" / "$50.000 del primer mes". */
export function textoDescuento(c: Pick<CodigoPromocional, 'tipoDescuento' | 'valor'>): string {
  return c.tipoDescuento === 'PORCENTAJE'
    ? `${c.valor} % del primer mes`
    : `$${Math.round(c.valor).toLocaleString('es-CO')} del primer mes`;
}

/**
 * Las reglas de `ServicioCodigosPromocionales.EvaluarAsync` (modo local: una sola empresa en el navegador, así que
 * EMPRESAS aplica si `empresaId` está en la lista). Lanza `ErrorCrud` VALIDACION con el motivo.
 */
export function evaluarCodigo(
  codigos: CodigoPromocional[],
  texto: string,
  plan: Plan,
  periodo: PeriodoPago,
  contexto: { empresaId: string; usosDeLaEmpresa: (id: string) => number; primeraCompra: boolean },
  hoy = fechaIso(),
): ValidacionCodigo {
  const no = (mensaje: string) => new ErrorCrud(mensaje, 'VALIDACION');
  const c = codigos.find((x) => x.codigo === normalizarCodigo(texto));
  if (!c || c.estado !== 'ACTIVO') throw no('El código promocional no existe o no está activo.');
  if (plan.precioMensual === 0) throw no('El plan Gratis no requiere pago.');
  if (hoy < c.fechaInicio) throw no(`El código ${c.codigo} es válido desde el ${fechaCorta(c.fechaInicio)}.`);
  if (hoy > c.fechaFin) throw no(`El código ${c.codigo} venció el ${fechaCorta(c.fechaFin)}.`);
  if (c.planes.length && !c.planes.includes(plan.id)) throw no(`El código ${c.codigo} no aplica para el plan ${plan.nombre}.`);
  if (c.periodo && c.periodo !== periodo) throw no(`El código ${c.codigo} solo aplica al pago ${c.periodo === 'ANUAL' ? 'anual' : 'mensual'}.`);
  if (c.alcance === 'EMPRESAS' && !c.empresaIds.includes(contexto.empresaId)) throw no(`El código ${c.codigo} no aplica para tu empresa.`);
  if (c.alcance === 'PRIMERA_COMPRA' && !contexto.primeraCompra) throw no(`El código ${c.codigo} es solo para la primera compra de un plan.`);
  if (c.usosMaximos !== null && (c.usos ?? 0) >= c.usosMaximos) throw no(`El código ${c.codigo} ya alcanzó su límite de usos.`);
  if (contexto.usosDeLaEmpresa(c.id) >= c.usosPorEmpresa) throw no(`Tu empresa ya usó el código ${c.codigo}.`);
  const precio = periodo === 'ANUAL' ? plan.precioAnual : plan.precioMensual;
  const descuento = descuentoCodigo(c.tipoDescuento, c.valor, plan.precioMensual, precio);
  return { codigo: c.codigo, descripcion: c.descripcion, tipoDescuento: c.tipoDescuento, valor: c.valor, plan: plan.id, periodo, precio, descuento, total: precio - descuento };
}
