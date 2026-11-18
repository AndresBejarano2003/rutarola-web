import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DatosRegistro } from 'src/app/shared/crud/crud';
import { periodoDe } from 'src/app/shared/fechas/fechas';
import { repositoriosDePrueba } from 'src/app/shared/pruebas/pruebas';
import { Cotizacion, calcularValores } from './cotizaciones/cotizacion';
import { simularPago } from './cuotas';
import { CotizacionesRepositorio } from './cotizaciones/cotizaciones-repositorio';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { Factura } from './facturas/factura';
import { FacturasRepositorio } from './facturas/facturas-repositorio';
import { Programacion } from './programacion/programacion';
import { ProgramacionesRepositorio } from './programacion/programaciones-repositorio';
import { Recibo } from './recibos/recibo';
import { RecibosRepositorio } from './recibos/recibos-repositorio';
import { ReportesRepositorio } from './reportes/reportes-repositorio';

const FACTURA: DatosRegistro<Factura> = {
  numero: '',
  fechaEmision: '2026-11-01',
  acudienteId: 'acu-1',
  estudianteId: 'est-1',
  nombreAcudiente: 'María Pérez López',
  nombreEstudiante: 'Juan Sebastián Pérez López',
  valorContratacion: 420000,
  periodoInicio: '2026-11',
  periodoFin: '2026-11',
  concepto: 'Transporte escolar',
  estado: 'ACTIVO',
  observaciones: '',
};

const COTIZACION_NUEVA: DatosRegistro<Cotizacion> = {
  numero: '',
  fecha: '2026-11-05',
  registrados: false,
  acudienteId: null,
  nombreAcudiente: 'Cliente Nuevo',
  telefonoAcudiente: '3000000000',
  estudiantes: [
    { estudianteId: null, nombre: 'Uno', colegioId: 'col-5', nombreColegio: '', valor: 350000 },
    { estudianteId: null, nombre: 'Dos', colegioId: null, nombreColegio: 'Liceo Los Andes', valor: 300000 },
  ],
  periodoInicio: '2027-02',
  periodoFin: '2027-11',
  valorMensual: 0,
  meses: 0,
  valorTotal: 0,
  facturas: [],
  estado: 'PENDIENTE',
  observaciones: '',
};

/** Recibo de prueba sobre una factura del ejemplo. */
function recibo(facturaId: string, numeroFactura: string, valor: number, cambios: Partial<DatosRegistro<Recibo>> = {}): DatosRegistro<Recibo> {
  return {
    numero: '',
    facturaId,
    numeroFactura,
    nombreAcudiente: '',
    nombreEstudiante: '',
    periodo: '',
    fechaPago: '2026-11-03',
    valor,
    medioPago: 'EFECTIVO',
    referencia: '',
    estado: 'ACTIVO',
    observaciones: '',
    ...cambios,
  };
}

describe('Reglas de negocio de Finanzas', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: repositoriosDePrueba() });
  });

  it('la cotización suma el valor de cada estudiante (de distintos colegios) por los meses del servicio', async () => {
    expect(calcularValores([{ valor: 300000 }, { valor: 250000 }], '2027-02', '2027-04')).toEqual({ valorMensual: 550000, meses: 3, valorTotal: 1650000 });
    const creada = await firstValueFrom(TestBed.inject(CotizacionesRepositorio).crear(COTIZACION_NUEVA));
    expect(creada.valorMensual).toBe(650000);
    expect(creada.meses).toBe(10);
    expect(creada.valorTotal).toBe(6500000);
    expect(creada.estudiantes.map((e) => e.nombreColegio)).toEqual(['Colegio San José', 'Liceo Los Andes']);
    expect(creada.numero).toMatch(/^COT-\d{4}$/);
    await expect(
      firstValueFrom(TestBed.inject(CotizacionesRepositorio).crear({ ...COTIZACION_NUEVA, periodoInicio: '2027-05', periodoFin: '2027-02' })),
    ).rejects.toThrow(/mes final/);
  });

  it('la cotización aprobada se convierte en una factura por estudiante y queda de solo lectura', async () => {
    const cotizaciones = TestBed.inject(CotizacionesRepositorio);
    const nueva = await firstValueFrom(cotizaciones.crear(COTIZACION_NUEVA));
    await expect(firstValueFrom(cotizaciones.facturar(nueva.id, '2027-01-20', ''))).rejects.toThrow(/registrad/);

    const registrada = await firstValueFrom(
      cotizaciones.crear({
        ...COTIZACION_NUEVA,
        registrados: true,
        acudienteId: 'acu-1',
        nombreAcudiente: 'María Pérez López',
        estudiantes: [{ estudianteId: 'est-1', nombre: 'Juan Sebastián Pérez López', colegioId: null, nombreColegio: '', valor: 410000 }],
        periodoInicio: '2027-02',
        periodoFin: '2027-06',
      }),
    );
    const { cotizacion, facturas } = await firstValueFrom(cotizaciones.facturar(registrada.id, '2027-01-20', 'Transporte 2027'));
    expect(cotizacion.estado).toBe('APROBADA');
    expect(facturas).toHaveLength(1);
    expect(facturas[0]).toMatchObject({ estudianteId: 'est-1', valorContratacion: 410000, periodoInicio: '2027-02', periodoFin: '2027-06', numeroCotizacion: cotizacion.numero });
    expect(cotizacion.facturas.map((f) => f.id)).toEqual([facturas[0].id]);

    await expect(firstValueFrom(cotizaciones.facturar(registrada.id, '2027-01-20', ''))).rejects.toMatchObject({ codigo: 'DUPLICADO' });
    const { id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = cotizacion;
    await expect(firstValueFrom(cotizaciones.actualizar(registrada.id, { ...datos, observaciones: 'cambio' }))).rejects.toThrow(/ya se convirtió/);
    await expect(firstValueFrom(cotizaciones.motivoNoEliminar(registrada.id))).resolves.toMatch(/facturas/);
  });

  it('la factura exige que el estudiante sea del acudiente y no se cruce con otra vigente', async () => {
    const facturas = TestBed.inject(FacturasRepositorio);
    await expect(firstValueFrom(facturas.crear(FACTURA))).rejects.toBeTruthy(); // est-1 ya tiene fac-1 vigente
    await expect(
      firstValueFrom(facturas.crear({ ...FACTURA, estudianteId: 'est-3', nombreEstudiante: 'Samuel', periodoInicio: '2027-01', periodoFin: '2027-02' })),
    ).rejects.toThrow(/no está a cargo/);
    const creada = await firstValueFrom(facturas.crear({ ...FACTURA, periodoInicio: '2027-01', periodoFin: '2027-11' }));
    expect(creada.numero).toBe('FAC-0007');
  });

  it('no permite eliminar una factura con recibos ni pagar dos veces el mismo mes', async () => {
    const facturas = TestBed.inject(FacturasRepositorio);
    await expect(firstValueFrom(facturas.eliminar('fac-1'))).rejects.toMatchObject({ codigo: 'EN_USO' });

    const recibo: DatosRegistro<Recibo> = {
      numero: '',
      facturaId: 'fac-1',
      numeroFactura: 'FAC-0001',
      nombreAcudiente: 'María Pérez López',
      nombreEstudiante: 'Juan Sebastián Pérez López',
      periodo: '2026-02',
      fechaPago: '2026-02-03',
      valor: 420000,
      medioPago: 'EFECTIVO',
      referencia: '',
      estado: 'ACTIVO',
      observaciones: '',
    };
    await expect(firstValueFrom(TestBed.inject(RecibosRepositorio).crear(recibo))).rejects.toMatchObject({ codigo: 'DUPLICADO' });
  });

  it('la programación exige exactamente un mensaje "En uso" por canal y una por factura', async () => {
    const programaciones = TestBed.inject(ProgramacionesRepositorio);
    const datos: DatosRegistro<Programacion> = {
      nombre: 'Prueba',
      facturaId: 'fac-3',
      numeroFactura: 'FAC-0003',
      diaLimitePago: 5,
      diasPrevios: 3,
      whatsapp: true,
      mensajesWhatsapp: [{ id: 'm1', asunto: '', cuerpo: 'Hola {acudiente}', adjuntos: [], estado: 'ACTIVO' }],
      email: false,
      correos: [],
      estado: 'ACTIVO',
    };
    await expect(firstValueFrom(programaciones.crear(datos))).rejects.toThrow(/En uso/);
    await expect(firstValueFrom(programaciones.crear({ ...datos, whatsapp: false }))).rejects.toThrow(/WhatsApp, correo o ambos/);
    await expect(firstValueFrom(programaciones.crear({ ...datos, facturaId: 'fac-1' }))).rejects.toMatchObject({ codigo: 'DUPLICADO' });

    const creada = await firstValueFrom(
      programaciones.crear({ ...datos, mensajesWhatsapp: [{ ...datos.mensajesWhatsapp[0], estado: 'EN_USO' }] }),
    );
    expect(await firstValueFrom(programaciones.historial(creada.id))).toEqual([]);
  });

  it('los reportes se calculan con las facturas, recibos y programaciones', async () => {
    const reportes = TestBed.inject(ReportesRepositorio);
    const ingresos = await firstValueFrom(reportes.ingresos({ desde: '2026-01', hasta: periodoDe(), medioPago: '' }));
    expect(ingresos.cantidad).toBeGreaterThan(0);
    expect(ingresos.total).toBe(ingresos.porMes.reduce((s, m) => s + m.total, 0));

    const pendientes = await firstValueFrom(reportes.pendientes({ texto: '', acudienteId: '', situacion: '' }));
    expect(pendientes.every((c) => c.periodo <= periodoDe())).toBe(true);

    const morosos = await firstValueFrom(reportes.morosos({ texto: '', diasMinimos: 0 }));
    expect(morosos.every((m) => m.diasMoraMaxima > 0 && m.valorAdeudado > 0)).toBe(true);
    // Ordenados de mayor a menor mora.
    expect(morosos.map((m) => m.diasMoraMaxima)).toEqual([...morosos.map((m) => m.diasMoraMaxima)].sort((a, b) => b - a));
  });
  it('un abono parcial deja el mes pendiente con su saldo y otro recibo lo completa', async () => {
    const facturas = TestBed.inject(FacturasRepositorio);
    const recibos = TestBed.inject(RecibosRepositorio);
    // fac-2: 380 000 mensuales, pagada hasta agosto.
    await firstValueFrom(recibos.crear(recibo('fac-2', 'FAC-0002', 130000, { aplicacion: 'MESES', periodos: ['2026-09'] })));
    let septiembre = (await firstValueFrom(facturas.cuotas('fac-2'))).find((c) => c.periodo === '2026-09')!;
    expect(septiembre).toMatchObject({ pagado: 130000, saldo: 250000 });
    expect(septiembre.estado).not.toBe('PAGADA');

    await expect(
      firstValueFrom(recibos.crear(recibo('fac-2', 'FAC-0002', 260000, { aplicacion: 'MESES', periodos: ['2026-09'] }))),
    ).rejects.toThrow(/supera el saldo/);
    await firstValueFrom(recibos.crear(recibo('fac-2', 'FAC-0002', 250000, { aplicacion: 'MESES', periodos: ['2026-09'] })));
    septiembre = (await firstValueFrom(facturas.cuotas('fac-2'))).find((c) => c.periodo === '2026-09')!;
    expect(septiembre).toMatchObject({ saldo: 0, estado: 'PAGADA' });
  });

  it('un recibo de varios meses cancela los que alcanza y abona el resto al siguiente', async () => {
    const facturas = TestBed.inject(FacturasRepositorio);
    // fac-4: 450 000 mensuales, pagada hasta julio.
    const cuotas = await firstValueFrom(facturas.cuotas('fac-4'));
    const previa = simularPago(cuotas, 1000000, 'MESES', ['2026-08', '2026-09', '2026-10'], 'FAC-0004');
    expect(previa.cancelados).toEqual(['2026-08', '2026-09']);
    expect(previa.abono).toEqual({ periodo: '2026-10', valor: 100000 });
    expect(previa.saldoAbono).toBe(350000);
    expect(previa.faltante).toBe(350000);

    const creado = await firstValueFrom(
      TestBed.inject(RecibosRepositorio).crear(recibo('fac-4', 'FAC-0004', 1000000, { aplicacion: 'MESES', periodos: ['2026-08', '2026-09', '2026-10'] })),
    );
    expect(creado.meses).toEqual([
      { periodo: '2026-08', valor: 450000 },
      { periodo: '2026-09', valor: 450000 },
      { periodo: '2026-10', valor: 100000 },
    ]);
    const despues = await firstValueFrom(facturas.cuotas('fac-4'));
    expect(despues.find((c) => c.periodo === '2026-10')).toMatchObject({ pagado: 100000, saldo: 350000 });
    expect(despues.find((c) => c.periodo === '2026-11')).toMatchObject({ pagado: 0 });
  });

  it('el abono al saldo de la factura paga primero los meses más antiguos', async () => {
    // fac-6: 390 000 mensuales, pagada hasta septiembre (quedan octubre y noviembre).
    const recibos = TestBed.inject(RecibosRepositorio);
    await expect(firstValueFrom(recibos.crear(recibo('fac-6', 'FAC-0006', 800000, { aplicacion: 'SALDO' })))).rejects.toThrow(/saldo de la factura/);
    const creado = await firstValueFrom(recibos.crear(recibo('fac-6', 'FAC-0006', 500000, { aplicacion: 'SALDO' })));
    expect(creado.meses).toEqual([
      { periodo: '2026-10', valor: 390000 },
      { periodo: '2026-11', valor: 110000 },
    ]);
  });

  it('el retiro deja de cobrar los meses que faltan y no puede borrar meses con pagos', async () => {
    const facturas = TestBed.inject(FacturasRepositorio);
    // fac-2: pagada hasta agosto.
    await expect(firstValueFrom(facturas.retiro('fac-2', '2026-08', 'Cambio de colegio'))).rejects.toBeTruthy();
    const retirada = await firstValueFrom(facturas.retiro('fac-2', '2026-10', 'Cambio de colegio'));
    expect(retirada.periodoRetiro).toBe('2026-10');
    const cuotas = await firstValueFrom(facturas.cuotas('fac-2'));
    expect(cuotas.at(-1)?.periodo).toBe('2026-09');

    const pendientes = await firstValueFrom(TestBed.inject(ReportesRepositorio).pendientes({ texto: '', acudienteId: '', situacion: '' }));
    expect(pendientes.some((c) => c.facturaId === 'fac-2' && c.periodo >= '2026-10')).toBe(false);

    const sinRetiro = await firstValueFrom(facturas.retiro('fac-2', '', ''));
    expect(sinRetiro.periodoRetiro || '').toBe('');
    expect((await firstValueFrom(facturas.cuotas('fac-2'))).at(-1)?.periodo).toBe('2026-11');
  });
  it('al inactivar al estudiante su factura deja de cobrar desde el mes siguiente (después de lo pagado)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-10T12:00:00'));
    try {
      const estudiantes = TestBed.inject(EstudiantesRepositorio);
      const { id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = await firstValueFrom(estudiantes.obtener('est-2'));
      await firstValueFrom(estudiantes.actualizar('est-2', { ...datos, estado: 'INACTIVO' }));
      // fac-2 (est-2) está pagada hasta agosto: septiembre se cobra y desde octubre ya no.
      const factura = await firstValueFrom(TestBed.inject(FacturasRepositorio).obtener('fac-2'));
      expect(factura.periodoRetiro).toBe('2026-10');
      expect(factura.motivoRetiro).toMatch(/inactivo/);
    } finally {
      vi.useRealTimers();
    }
  });
});
