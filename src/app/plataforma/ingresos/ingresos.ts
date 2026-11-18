import { PagoSuscripcion, PeriodoPago, PlanSuscripcion, nombrePlan } from 'src/app/sistema/membresias/suscripcion';

/** Espejo de `IngresosPlataforma.cs` (`GET /plataforma/ingresos?desde=&hasta=`). Montos en pesos con IVA, ya con descuentos. */
export interface PuntoIngresos {
  /** `YYYY-MM-DD` (agrupación DIA) o `YYYY-MM` (MES). */
  periodo: string;
  total: number;
  pagos: number;
}

export interface GrupoIngresos {
  clave: string;
  nombre: string;
  total: number;
  pagos: number;
}

export interface EmpresaIngresos {
  empresaId: string;
  nombre: string;
  total: number;
  pagos: number;
}

export interface PagoPlataforma {
  id: string;
  /** ISO 8601: cuándo se aplicó el pago. */
  fecha: string;
  empresaId: string;
  empresa: string;
  plan: PlanSuscripcion;
  periodo: PeriodoPago;
  valor: number;
  descuento: number;
  /** Nombre del medio ("Tarjeta", "PSE", "Registrado por la plataforma"…). */
  metodo: string;
  referencia: string;
  codigoPromocional: string;
}

export interface IngresosPlataforma {
  desde: string;
  hasta: string;
  agrupacion: 'DIA' | 'MES';
  total: number;
  pagos: number;
  empresas: number;
  ticketPromedio: number;
  descuentos: number;
  /** Mismo número de días justo antes de `desde`. */
  totalAnterior: number;
  pagosAnterior: number;
  /** Valor mensual equivalente de los planes pagados vigentes hoy (anual / 12). */
  recurrenteMensual: number;
  empresasPagando: number;
  serie: PuntoIngresos[];
  porPlan: GrupoIngresos[];
  porPeriodo: GrupoIngresos[];
  porMetodo: GrupoIngresos[];
  /** Las 10 que más pagaron. */
  topEmpresas: EmpresaIngresos[];
  /** Los pagos del rango, más recientes primero (máximo 500). */
  detalle: PagoPlataforma[];
}

export type PresetIngresos = 'ESTE_MES' | 'MES_PASADO' | 'ULTIMOS_3' | 'ULTIMOS_6' | 'ULTIMOS_12' | 'ESTE_ANIO' | 'ANIO_PASADO' | 'PERSONALIZADO';

export const PRESETS_INGRESOS: { id: PresetIngresos; nombre: string }[] = [
  { id: 'ESTE_MES', nombre: 'Este mes' },
  { id: 'MES_PASADO', nombre: 'Mes pasado' },
  { id: 'ULTIMOS_3', nombre: 'Últimos 3 meses' },
  { id: 'ULTIMOS_6', nombre: 'Últimos 6 meses' },
  { id: 'ULTIMOS_12', nombre: 'Últimos 12 meses' },
  { id: 'ESTE_ANIO', nombre: 'Este año' },
  { id: 'ANIO_PASADO', nombre: 'Año pasado' },
  { id: 'PERSONALIZADO', nombre: 'Personalizado' },
];

export const DIAS_MAXIMOS_POR_DIA = 62;
export const DIAS_MAXIMOS_INGRESOS = 3 * 366;
const MAXIMO_DETALLE = 500;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** Rango `YYYY-MM-DD` (ambos incluidos) de un preset; `hoy` es la fecha de Colombia. Los "últimos N meses" incluyen el actual. */
export function rangoPreset(preset: PresetIngresos, hoy: string): { desde: string; hasta: string } {
  const [y, m] = hoy.split('-').map(Number);
  const mes = m - 1;
  switch (preset) {
    case 'MES_PASADO':
      return { desde: iso(utc(y, mes - 1, 1)), hasta: iso(utc(y, mes, 0)) };
    case 'ULTIMOS_3':
      return { desde: iso(utc(y, mes - 2, 1)), hasta: hoy };
    case 'ULTIMOS_6':
      return { desde: iso(utc(y, mes - 5, 1)), hasta: hoy };
    case 'ULTIMOS_12':
      return { desde: iso(utc(y, mes - 11, 1)), hasta: hoy };
    case 'ESTE_ANIO':
      return { desde: `${y}-01-01`, hasta: hoy };
    case 'ANIO_PASADO':
      return { desde: `${y - 1}-01-01`, hasta: `${y - 1}-12-31` };
    default:
      return { desde: iso(utc(y, mes, 1)), hasta: hoy };
  }
}

export function diasDelRango(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Variación porcentual frente al periodo anterior; null si antes no hubo ingresos. */
export function variacion(actual: number, anterior: number): number | null {
  return anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null;
}

/** Igual que `ServicioIngresosPlataforma.NombreMetodo`. */
export function nombreMetodo(metodo: string): string {
  const nombres: Record<string, string> = {
    MANUAL: 'Registrado por la plataforma',
    CODIGO_PROMOCIONAL: 'Código promocional',
    CARD: 'Tarjeta',
    NEQUI: 'Nequi',
    PSE: 'PSE',
    BANCOLOMBIA_TRANSFER: 'Transferencia Bancolombia',
    BANCOLOMBIA_QR: 'QR Bancolombia',
    DAVIPLATA: 'Daviplata',
  };
  return nombres[metodo] ?? (metodo || 'Otro');
}

export interface PagoConEmpresa extends PagoSuscripcion {
  empresaId: string;
  empresa: string;
}

/** Día de Colombia de un instante ISO. */
function diaColombia(isoFecha: string): string {
  return new Date(new Date(isoFecha).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

function agrupar<T>(lista: T[], clave: (x: T) => string, nombre: (k: string) => string, valor: (x: T) => number): GrupoIngresos[] {
  const mapa = new Map<string, GrupoIngresos>();
  for (const x of lista) {
    const k = clave(x);
    const g = mapa.get(k) ?? { clave: k, nombre: nombre(k), total: 0, pagos: 0 };
    g.total += valor(x);
    g.pagos += 1;
    mapa.set(k, g);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

/**
 * Mismas reglas que `ServicioIngresosPlataforma` para el modo local: pagos APROBADOS con valor, por el día (Colombia)
 * en que se aplicaron; serie por día hasta 62 días, si no por mes. `recurrente` = planes pagados vigentes hoy.
 */
export function calcularIngresos(
  pagos: PagoConEmpresa[],
  desde: string,
  hasta: string,
  recurrente: { mensual: number; empresas: number } = { mensual: 0, empresas: 0 },
): IngresosPlataforma {
  const dias = diasDelRango(desde, hasta);
  const anteriorHasta = iso(new Date(Date.parse(`${desde}T00:00:00Z`) - 86_400_000));
  const anteriorDesde = iso(new Date(Date.parse(`${anteriorHasta}T00:00:00Z`) - (dias - 1) * 86_400_000));
  const validos = pagos
    .filter((p) => p.estado === 'APROBADO' && p.valor > 0)
    .map((p) => ({ ...p, dia: diaColombia(p.fechaAplicacion ?? p.fechaCreacion) }));
  const enRango = validos.filter((p) => p.dia >= desde && p.dia <= hasta).sort((a, b) => b.dia.localeCompare(a.dia));
  const anteriores = validos.filter((p) => p.dia >= anteriorDesde && p.dia <= anteriorHasta);
  const agrupacion = dias <= DIAS_MAXIMOS_POR_DIA ? 'DIA' : 'MES';

  const serie: PuntoIngresos[] = [];
  if (agrupacion === 'DIA') {
    for (let i = 0; i < dias; i++) {
      const d = iso(new Date(Date.parse(`${desde}T00:00:00Z`) + i * 86_400_000));
      const del = enRango.filter((p) => p.dia === d);
      serie.push({ periodo: d, total: del.reduce((s, p) => s + p.valor, 0), pagos: del.length });
    }
  } else {
    for (let mes = desde.slice(0, 7); mes <= hasta.slice(0, 7); ) {
      const del = enRango.filter((p) => p.dia.startsWith(mes));
      serie.push({ periodo: mes, total: del.reduce((s, p) => s + p.valor, 0), pagos: del.length });
      const [y, m] = mes.split('-').map(Number);
      mes = iso(utc(y, m, 1)).slice(0, 7);
    }
  }

  const total = enRango.reduce((s, p) => s + p.valor, 0);
  const porEmpresa = agrupar(enRango, (p) => p.empresaId, () => '', (p) => p.valor);
  const nombres = new Map(enRango.map((p) => [p.empresaId, p.empresa]));
  return {
    desde,
    hasta,
    agrupacion,
    total,
    pagos: enRango.length,
    empresas: porEmpresa.length,
    ticketPromedio: enRango.length ? Math.round(total / enRango.length) : 0,
    descuentos: enRango.reduce((s, p) => s + (p.descuento ?? 0), 0),
    totalAnterior: anteriores.reduce((s, p) => s + p.valor, 0),
    pagosAnterior: anteriores.length,
    recurrenteMensual: recurrente.mensual,
    empresasPagando: recurrente.empresas,
    serie,
    porPlan: agrupar(enRango, (p) => p.plan, (k) => nombrePlan(k as PlanSuscripcion), (p) => p.valor),
    porPeriodo: agrupar(enRango, (p) => p.periodo, (k) => (k === 'ANUAL' ? 'Anual' : 'Mensual'), (p) => p.valor),
    porMetodo: agrupar(enRango, (p) => p.metodoPago, nombreMetodo, (p) => p.valor),
    topEmpresas: porEmpresa.slice(0, 10).map((g) => ({ empresaId: g.clave, nombre: nombres.get(g.clave) ?? '', total: g.total, pagos: g.pagos })),
    detalle: enRango.slice(0, MAXIMO_DETALLE).map((p) => ({
      id: p.id,
      fecha: p.fechaAplicacion ?? p.fechaCreacion,
      empresaId: p.empresaId,
      empresa: p.empresa,
      plan: p.plan,
      periodo: p.periodo,
      valor: p.valor,
      descuento: p.descuento ?? 0,
      metodo: nombreMetodo(p.metodoPago),
      referencia: p.referencia,
      codigoPromocional: p.codigoPromocional ?? '',
    })),
  };
}
