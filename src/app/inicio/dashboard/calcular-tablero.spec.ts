import { Factura } from 'src/app/finanzas/facturas/factura';
import { Recibo } from 'src/app/finanzas/recibos/recibo';
import { CuotaPendiente } from 'src/app/finanzas/reportes/reportes';
import { Asignacion } from 'src/app/operacion/asignaciones/asignacion';
import { Ruta } from 'src/app/operacion/rutas/ruta';
import { Vehiculo } from 'src/app/operacion/vehiculos/vehiculo';
import { Estudiante } from 'src/app/personas/estudiantes/estudiante';
import { DatosTablero, calcularTablero } from './calcular-tablero';

const AHORA = new Date('2026-11-05T10:00:00');

const vacios = (): DatosTablero => ({
  facturas: [], recibos: [], cuotas: [], estudiantes: [], colegios: [], rutas: [],
  asignaciones: [], vehiculos: [], empleados: [], cotizaciones: [], programaciones: [], envios: [],
});

const factura = (id: string, valor: number, inicio: string, fin: string, estado: Factura['estado'] = 'ACTIVO') =>
  ({ id, numero: id, valorContratacion: valor, periodoInicio: inicio, periodoFin: fin, estado }) as Factura;
const recibo = (id: string, valor: number, periodo: string, estado: Recibo['estado'] = 'ACTIVO') =>
  ({ id, numero: id, valor, periodo, fechaPago: `${periodo}-03`, estado }) as Recibo;
const cuota = (acudienteId: string, valor: number, diasMora: number, fechaLimite = '2026-11-10') =>
  ({ acudienteId, valor, diasMora, fechaLimite }) as CuotaPendiente;

describe('calcularTablero', () => {
  it('calcula recaudo, esperado y mes anterior solo con registros vigentes', () => {
    const t = calcularTablero(
      {
        ...vacios(),
        facturas: [factura('F1', 300_000, '2026-01', '2026-12'), factura('F2', 200_000, '2026-11', '2027-06'), factura('F3', 999, '2026-01', '2026-12', 'INACTIVO')],
        recibos: [recibo('R1', 300_000, '2026-11'), recibo('R2', 300_000, '2026-10'), recibo('R3', 50, '2026-11', 'INACTIVO')],
      },
      AHORA,
    );
    expect(t.periodo).toBe('2026-11');
    expect(t.recaudo).toEqual({ recaudado: 300_000, esperado: 500_000, pagos: 1, anterior: 300_000 });
    expect(t.historico).toHaveLength(12);
    expect(t.historico.at(-1)).toEqual({ periodo: '2026-11', facturado: 500_000, recaudado: 300_000 });
  });

  it('separa cartera vencida de la que aún está en plazo y la lleva a "Requiere atención"', () => {
    const t = calcularTablero({ ...vacios(), cuotas: [cuota('a1', 100, 10), cuota('a1', 100, 40), cuota('a2', 50, 3), cuota('a3', 70, -5)] }, AHORA);
    expect(t.cartera).toEqual({ vencida: 250, cuotasVencidas: 3, acudientesEnMora: 2, porVencer: 70 });
    expect(t.pendientes.find((p) => p.id === 'mora')?.cantidad).toBe(2);
    expect(t.agenda.find((e) => e.tipo === 'PAGO')?.fecha).toBe('2026-11-10');
  });

  it('detecta estudiantes sin ruta, rutas sin asignación y la ocupación', () => {
    const t = calcularTablero(
      {
        ...vacios(),
        estudiantes: ['e1', 'e2', 'e3'].map((id) => ({ id, estado: 'ACTIVO', colegioId: 'c1' }) as Estudiante),
        rutas: [
          { id: 'r1', codigo: 'R-1', nombre: 'Norte', estudianteIds: ['e1', 'e2'], estado: 'ACTIVO' } as Ruta,
          { id: 'r2', codigo: 'R-2', nombre: 'Sur', estudianteIds: [] as string[], estado: 'ACTIVO' } as Ruta,
        ],
        asignaciones: [{ rutaId: 'r1', vehiculoId: 'v1', estado: 'ACTIVO', fechaInicio: '2026-01-01', fechaFin: '' } as Asignacion],
        vehiculos: [{ id: 'v1', capacidad: 10, estado: 'ACTIVO', vencimientoSoat: '2030-01-01', vencimientoTecnomecanica: '2030-01-01', vencimientoTarjetaOperacion: '2030-01-01', vencimientoPolizas: '2030-01-01' } as Vehiculo],
      },
      AHORA,
    );
    expect(t.estudiantes.sinRuta).toBe(1);
    expect(t.operacion.rutasSinAsignacion).toBe(1);
    expect(t.operacion.ocupacion).toBe(20);
    expect(t.ocupacionRutas[0]).toEqual({ ruta: 'R-1 · Norte', estudiantes: 2, capacidad: 10 });
    expect(t.pendientes.map((p) => p.id)).toEqual(['sin-ruta', 'rutas-sin-asignacion']);
  });

  it('sin datos no hay pendientes ni agenda', () => {
    const t = calcularTablero(vacios(), AHORA);
    expect(t.pendientes).toEqual([]);
    expect(t.agenda).toEqual([]);
    expect(t.operacion.ocupacion).toBeNull();
  });
});
