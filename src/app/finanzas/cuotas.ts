import { ErrorCrud } from 'src/app/shared/crud/crud';
import { nombrePeriodo, periodosEntre, sumarMeses } from 'src/app/shared/fechas/fechas';

/**
 * Reglas de las cuotas (iguales a `Application/Finanzas/Cuotas.cs` del API). Una factura vigente cobra cada mes
 * de `periodoInicio` a `periodoFin`, salvo desde `periodoRetiro` (retiro del estudiante o del acudiente). Un mes
 * está pagado cuando lo aplicado por recibos válidos cubre el valor mensual; si no, queda pendiente con su saldo
 * (abono parcial). Un recibo reparte su valor en orden: primero completa los meses más antiguos y el resto queda
 * como abono del siguiente.
 */

/** Valor de un recibo aplicado a un mes (`YYYY-MM`). */
export interface PagoMes {
  periodo: string;
  valor: number;
}

export interface Cuota {
  periodo: string;
  /** Valor del mes. */
  valor: number;
  /** Lo aplicado por recibos válidos. */
  pagado: number;
  /** Lo que falta (0 = pagada). */
  saldo: number;
}

/** MESES = paga o abona los meses elegidos; SALDO = abona al saldo de la factura (los meses más antiguos primero). */
export type AplicacionRecibo = 'MESES' | 'SALDO';

export interface FacturaCobrable {
  periodoInicio: string;
  periodoFin: string;
  /** Primer mes que ya NO se cobra (`''` = sin retiro). */
  periodoRetiro?: string;
  valorContratacion: number;
}

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** `$ 230.000` (mismo formato que `Cobro.Pesos` del API). */
export function textoPesos(valor: number): string {
  return pesos.format(Math.round(valor)).replace(/ /g, ' ');
}

/** Último mes que se cobra (`null` si el retiro es desde el primer mes). */
export function ultimoMesCobrable(f: Omit<FacturaCobrable, 'valorContratacion'>): string | null {
  const ultimo = f.periodoRetiro && f.periodoRetiro <= f.periodoFin ? sumarMeses(f.periodoRetiro, -1) : f.periodoFin;
  return ultimo < f.periodoInicio ? null : ultimo;
}

export function mesesCobrables(f: Omit<FacturaCobrable, 'valorContratacion'>): string[] {
  const ultimo = ultimoMesCobrable(f);
  return ultimo ? periodosEntre(f.periodoInicio, ultimo) : [];
}

export function cuotasFactura(f: FacturaCobrable, pagos: readonly PagoMes[]): Cuota[] {
  const pagado = new Map<string, number>();
  for (const p of pagos) pagado.set(p.periodo, (pagado.get(p.periodo) ?? 0) + p.valor);
  return mesesCobrables(f).map((periodo) => {
    const valor = f.valorContratacion;
    const total = pagado.get(periodo) ?? 0;
    return { periodo, valor, pagado: total, saldo: Math.max(0, valor - total) };
  });
}

/** Lo que aplicó cada recibo válido (los antiguos sin detalle cuentan su valor en su periodo). */
export function pagosDeRecibos(
  recibos: readonly { estado: string; periodo: string; valor: number; meses?: readonly PagoMes[] }[],
): PagoMes[] {
  return recibos
    .filter((r) => r.estado === 'ACTIVO')
    .flatMap((r) => (r.meses?.length ? r.meses : r.periodo ? [{ periodo: r.periodo, valor: r.valor }] : []));
}

/**
 * Reparte `valor` sobre los meses con saldo (todos o solo `meses`), del más antiguo al más reciente. Lanza
 * `ErrorCrud` (mismos mensajes que el API) si un mes elegido no se cobra o ya está pagado, o si el valor supera el
 * saldo disponible.
 */
export function distribuir(
  cuotas: readonly Cuota[],
  valor: number,
  aplicacion: AplicacionRecibo,
  meses: readonly string[],
  numeroFactura: string,
): PagoMes[] {
  let destino: Cuota[];
  if (aplicacion === 'MESES') {
    if (!meses.length) throw new ErrorCrud('Elige al menos un mes a pagar.', 'VALIDACION');
    const porMes = new Map(cuotas.map((c) => [c.periodo, c]));
    const elegidos = [...new Set(meses)].sort();
    for (const mes of elegidos) {
      const cuota = porMes.get(mes);
      if (!cuota) throw new ErrorCrud(`${nombrePeriodo(mes, true)} no se cobra en la factura ${numeroFactura}.`, 'VALIDACION');
      if (cuota.saldo <= 0) throw new ErrorCrud(`${nombrePeriodo(mes, true)} de la factura ${numeroFactura} ya está pagado.`, 'DUPLICADO');
    }
    destino = elegidos.map((m) => porMes.get(m)!);
  } else {
    destino = cuotas.filter((c) => c.saldo > 0);
  }
  const disponible = destino.reduce((s, c) => s + c.saldo, 0);
  if (disponible <= 0) throw new ErrorCrud(`La factura ${numeroFactura} no tiene saldo pendiente.`, 'VALIDACION');
  if (valor > disponible) {
    throw new ErrorCrud(
      aplicacion === 'MESES'
        ? `El valor supera el saldo de los meses elegidos (${textoPesos(disponible)}).`
        : `El valor supera el saldo de la factura ${numeroFactura} (${textoPesos(disponible)}).`,
      'VALIDACION',
    );
  }
  let resto = valor;
  const lineas: PagoMes[] = [];
  for (const c of destino) {
    if (resto <= 0) break;
    const aplicado = Math.min(resto, c.saldo);
    lineas.push({ periodo: c.periodo, valor: aplicado });
    resto -= aplicado;
  }
  return lineas;
}

/** Cómo queda un pago: meses que se cancelan, el abono y lo que sigue pendiente (vista previa del recibo). */
export interface ResultadoPago {
  lineas: PagoMes[];
  cancelados: string[];
  abono: PagoMes | null;
  /** Meses elegidos (o con saldo, en SALDO) que no alcanza a tocar. */
  sinCubrir: string[];
  /** Saldo que deja el abono en su mes. */
  saldoAbono: number;
  /** Lo que falta para cubrir todos los meses elegidos (0 = cubre todo). */
  faltante: number;
  total: number;
}

export function simularPago(
  cuotas: readonly Cuota[],
  valor: number,
  aplicacion: AplicacionRecibo,
  meses: readonly string[],
  numeroFactura: string,
): ResultadoPago {
  const lineas = distribuir(cuotas, valor, aplicacion, meses, numeroFactura);
  const porMes = new Map(cuotas.map((c) => [c.periodo, c]));
  const objetivo = aplicacion === 'MESES' ? [...new Set(meses)].sort() : cuotas.filter((c) => c.saldo > 0).map((c) => c.periodo);
  const total = objetivo.reduce((s, m) => s + (porMes.get(m)?.saldo ?? 0), 0);
  const cancelados = lineas.filter((l) => l.valor >= (porMes.get(l.periodo)?.saldo ?? 0)).map((l) => l.periodo);
  const parcial = lineas.find((l) => l.valor < (porMes.get(l.periodo)?.saldo ?? 0)) ?? null;
  const tocados = new Set(lineas.map((l) => l.periodo));
  return {
    lineas,
    cancelados,
    abono: parcial,
    sinCubrir: objetivo.filter((m) => !tocados.has(m)),
    saldoAbono: parcial ? (porMes.get(parcial.periodo)?.saldo ?? 0) - parcial.valor : 0,
    faltante: Math.max(0, total - valor),
    total,
  };
}

/** "enero y febrero de 2026" */
export function unirMeses(periodos: readonly string[]): string {
  const nombres = periodos.map((p) => nombrePeriodo(p, true));
  return nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}
