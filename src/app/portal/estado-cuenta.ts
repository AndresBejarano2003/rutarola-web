import { cuotasFactura } from 'src/app/finanzas/cuotas';
import { Factura } from 'src/app/finanzas/facturas/factura';
import { Recibo, mesesRecibo } from 'src/app/finanzas/recibos/recibo';
import { fechaLimiteCuota } from 'src/app/finanzas/reportes/reportes';
import { diasEntre, fechaIso, periodoDe } from 'src/app/shared/fechas/fechas';
import { CuotaPortal, FacturaPortal, ProximoPago, ReciboPortal, ResumenCuenta } from './portal';

const ORDEN_URGENCIA: Record<CuotaPortal['estado'], number> = { VENCIDA: 0, PENDIENTE: 1, PROGRAMADA: 2, PAGADA: 3 };

/**
 * Estado de cuenta de un acudiente (función pura; el API debe aplicar las mismas reglas):
 * cada mes que se cobra de cada factura vigente (sin los meses desde el retiro) queda PAGADA (los
 * recibos válidos cubren su valor), VENCIDA / PENDIENTE (mes ya iniciado con saldo, según la fecha
 * límite de `fechaLimiteCuota`) o PROGRAMADA (mes futuro); un abono deja pendiente solo el saldo.
 * Las facturas anuladas se muestran sin cuotas por cobrar y los recibos anulados no cuentan como pago.
 */
export function calcularEstadoCuenta(
  facturas: Factura[],
  recibos: Recibo[],
  diaLimitePorFactura: Map<string, number>,
  ahora = new Date(),
): { facturas: FacturaPortal[]; recibos: ReciboPortal[]; resumen: ResumenCuenta } {
  const hoy = fechaIso(ahora);
  const mesActual = periodoDe(ahora);
  const propias = new Set(facturas.map((f) => f.id));
  const recibosPropios = recibos.filter((r) => propias.has(r.facturaId));
  const aplicados = recibosPropios
    .filter((r) => r.estado === 'ACTIVO')
    .flatMap((r) => mesesRecibo(r).map((m) => ({ recibo: r, ...m })));

  const facturasPortal = facturas
    .map((f): FacturaPortal => {
      const deLaFactura = aplicados.filter((a) => a.recibo.facturaId === f.id);
      const cuotas =
        f.estado === 'ACTIVO'
          ? cuotasFactura(f, deLaFactura).map((c): CuotaPortal => {
              const periodo = c.periodo;
              const recibo =
                deLaFactura
                  .filter((a) => a.periodo === periodo)
                  .map((a) => a.recibo)
                  .sort((a, b) => b.fechaPago.localeCompare(a.fechaPago) || b.numero.localeCompare(a.numero))[0] ?? null;
              const fechaLimite = fechaLimiteCuota(periodo, diaLimitePorFactura.get(f.id));
              const diasMora = diasEntre(fechaLimite, hoy);
              const estado = c.saldo <= 0 ? 'PAGADA' : periodo > mesActual ? 'PROGRAMADA' : diasMora > 0 ? 'VENCIDA' : 'PENDIENTE';
              return {
                periodo,
                valor: c.valor,
                estado,
                fechaLimite,
                diasMora: estado === 'VENCIDA' || estado === 'PENDIENTE' ? diasMora : 0,
                recibo: recibo ? { id: recibo.id, numero: recibo.numero, fechaPago: recibo.fechaPago, medioPago: recibo.medioPago } : null,
                abonado: c.pagado,
                saldo: c.saldo,
              };
            })
          : [];
      return {
        id: f.id,
        numero: f.numero,
        fechaEmision: f.fechaEmision,
        estudianteId: f.estudianteId,
        estudiante: f.nombreEstudiante,
        concepto: f.concepto,
        valorMensual: f.valorContratacion,
        periodoInicio: f.periodoInicio,
        periodoFin: f.periodoFin,
        total: f.valorContratacion * cuotas.length,
        pagado: cuotas.reduce((s, c) => s + Math.min(c.abonado, c.valor), 0),
        vencido: cuotas.filter((c) => c.estado === 'VENCIDA').reduce((s, c) => s + c.saldo, 0),
        estado: f.estado,
        cuotas,
      };
    })
    // Vigentes primero; luego por fecha de emisión (más reciente primero).
    .sort((a, b) => a.estado.localeCompare(b.estado) || b.fechaEmision.localeCompare(a.fechaEmision));

  const numeroFactura = new Map(facturas.map((f) => [f.id, f.numero]));
  const recibosPortal = recibosPropios
    .map((r): ReciboPortal => ({
      id: r.id,
      numero: r.numero,
      numeroFactura: r.numeroFactura || (numeroFactura.get(r.facturaId) ?? ''),
      estudiante: r.nombreEstudiante,
      periodo: r.periodo,
      fechaPago: r.fechaPago,
      valor: r.valor,
      medioPago: r.medioPago,
      referencia: r.referencia,
      estado: r.estado,
    }))
    .sort((a, b) => b.fechaPago.localeCompare(a.fechaPago) || b.numero.localeCompare(a.numero));

  const sinPagar = facturasPortal.flatMap((f) =>
    f.cuotas.filter((c) => c.estado !== 'PAGADA').map((c): ProximoPago => ({
      numeroFactura: f.numero,
      estudiante: f.estudiante,
      periodo: c.periodo,
      valor: c.saldo,
      fechaLimite: c.fechaLimite,
      estado: c.estado,
    })),
  );
  sinPagar.sort((a, b) => ORDEN_URGENCIA[a.estado] - ORDEN_URGENCIA[b.estado] || a.fechaLimite.localeCompare(b.fechaLimite));
  const vencidas = sinPagar.filter((c) => c.estado === 'VENCIDA');
  const anio = hoy.slice(0, 4);
  const pagosAnio = recibosPortal.filter((r) => r.estado === 'ACTIVO' && r.fechaPago.startsWith(anio));

  return {
    facturas: facturasPortal,
    recibos: recibosPortal,
    resumen: {
      vencido: vencidas.reduce((s, c) => s + c.valor, 0),
      cuotasVencidas: vencidas.length,
      porPagar: sinPagar.filter((c) => c.estado === 'PENDIENTE').reduce((s, c) => s + c.valor, 0),
      proximoPago: sinPagar[0] ?? null,
      pagadoAnio: pagosAnio.reduce((s, r) => s + r.valor, 0),
      pagosAnio: pagosAnio.length,
    },
  };
}
