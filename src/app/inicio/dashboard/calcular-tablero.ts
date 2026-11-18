import { Cotizacion } from 'src/app/finanzas/cotizaciones/cotizacion';
import { Factura } from 'src/app/finanzas/facturas/factura';
import { EnvioProgramado, Programacion } from 'src/app/finanzas/programacion/programacion';
import { mesesCobrables, ultimoMesCobrable } from 'src/app/finanzas/cuotas';
import { Recibo, mesesRecibo } from 'src/app/finanzas/recibos/recibo';
import { CuotaPendiente } from 'src/app/finanzas/reportes/reportes';
import { Asignacion, asignacionVigente, cubreFecha } from 'src/app/operacion/asignaciones/asignacion';
import { Colegio } from 'src/app/operacion/colegios/colegio';
import { Ruta, etiquetaRuta } from 'src/app/operacion/rutas/ruta';
import { Vehiculo } from 'src/app/operacion/vehiculos/vehiculo';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { Empleado } from 'src/app/personas/empleados/empleado';
import { Estudiante } from 'src/app/personas/estudiantes/estudiante';
import { diaDelPeriodo, diasEntre, fechaIso, nombrePeriodo, periodoDe, sumarMeses } from 'src/app/shared/fechas/fechas';
import { estadoVencimiento } from 'src/app/shared/vencimiento/vencimiento';
import { DIAS_AGENDA, EventoAgenda, PendienteTablero, Tablero } from './tablero';

/** Datos de todos los módulos que alimentan la pantalla de inicio. */
export interface DatosTablero {
  facturas: Factura[];
  recibos: Recibo[];
  cuotas: CuotaPendiente[];
  estudiantes: Estudiante[];
  colegios: Colegio[];
  rutas: Ruta[];
  asignaciones: Asignacion[];
  vehiculos: Vehiculo[];
  empleados: Empleado[];
  cotizaciones: Cotizacion[];
  programaciones: Programacion[];
  envios: EnvioProgramado[];
}

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const DOCUMENTOS_VEHICULO = [
  ['vencimientoSoat', 'SOAT'],
  ['vencimientoTecnomecanica', 'Técnico-mecánica'],
  ['vencimientoTarjetaOperacion', 'Tarjeta de operación'],
  ['vencimientoPolizas', 'Pólizas'],
] as const;

/** Reglas de la pantalla de inicio (puras; el API debe calcular lo mismo en `GET /tablero`). */
export function calcularTablero(d: DatosTablero, ahora = new Date()): Tablero {
  const hoy = fechaIso(ahora);
  const periodo = periodoDe(ahora);
  const limiteAgenda = fechaIso(new Date(ahora.getTime() + DIAS_AGENDA * 86_400_000));

  const facturas = d.facturas.filter((f) => f.estado === 'ACTIVO');
  const recibos = d.recibos.filter((r) => r.estado === 'ACTIVO');
  // Esperado: meses que se cobran (sin retiros). Recaudado: lo que cada recibo aplicó a ese mes (un recibo de varios
  // meses o un abono cuenta en cada mes por su parte).
  const esperado = (p: string) => facturas.filter((f) => mesesCobrables(f).includes(p)).reduce((s, f) => s + f.valorContratacion, 0);
  const recaudadoDe = (p: string) =>
    recibos.flatMap((r) => mesesRecibo(r).filter((m) => m.periodo === p).map((m) => ({ id: r.id, valor: m.valor })));
  /** Fin del contrato = último mes que se cobra (un retiro lo adelanta). */
  const fin = (f: Factura) => ultimoMesCobrable(f) ?? '';
  const suma = (lista: { valor: number }[]) => lista.reduce((s, x) => s + x.valor, 0);

  // Cartera
  const vencidas = d.cuotas.filter((c) => c.diasMora > 0);
  const porVencer = d.cuotas.filter((c) => c.diasMora <= 0);
  const acudientesEnMora = new Set(vencidas.map((c) => c.acudienteId)).size;

  // Estudiantes y rutas
  const estudiantes = d.estudiantes.filter((e) => e.estado === 'ACTIVO');
  const rutas = d.rutas.filter((r) => r.estado === 'ACTIVO');
  const enRuta = new Set(rutas.flatMap((r) => r.estudianteIds));
  const sinRuta = estudiantes.filter((e) => !enRuta.has(e.id));
  // Las que cubren hoy (una ruta puede tener varias en fechas u horarios distintos).
  const asignaciones = d.asignaciones.filter((a) => a.estado === 'ACTIVO' && cubreFecha(a, hoy));
  const horaActual = ahora.toTimeString().slice(0, 5);
  const vehiculoPorId = new Map(d.vehiculos.map((v) => [v.id, v]));
  const ocupacionRutas = rutas
    .map((r) => {
      const asignacion = asignacionVigente(asignaciones, r.id, hoy, horaActual);
      return {
        ruta: etiquetaRuta(r),
        estudiantes: r.estudianteIds.length,
        capacidad: asignacion ? (vehiculoPorId.get(asignacion.vehiculoId)?.capacidad ?? null) : null,
      };
    })
    .sort((a, b) => porcentaje(b) - porcentaje(a));
  const conVehiculo = ocupacionRutas.filter((r) => r.capacidad);
  const cupos = conVehiculo.reduce((s, r) => s + (r.capacidad ?? 0), 0);

  // Vehículos y conductores
  const vehiculos = d.vehiculos.filter((v) => v.estado === 'ACTIVO');
  const conductores = d.empleados.filter((e) => e.estado === 'ACTIVO' && e.tipoEmpleado === 'CONDUCTOR');
  const docsVehiculo = vehiculos.map((v) => ({
    v,
    estados: DOCUMENTOS_VEHICULO.map(([campo]) => estadoVencimiento(v[campo], ahora)),
  }));
  const vehiculosVencidos = docsVehiculo.filter((x) => x.estados.includes('VENCIDA')).length;
  const vehiculosPorVencer = docsVehiculo.filter((x) => !x.estados.includes('VENCIDA') && x.estados.includes('POR_VENCER')).length;
  const licencias = conductores.map((c) => estadoVencimiento(c.vencimientoLicencia, ahora));
  const licenciasVencidas = licencias.filter((e) => e === 'VENCIDA').length;
  const licenciasPorVencer = licencias.filter((e) => e === 'POR_VENCER').length;

  // Contratos, cotizaciones, programación, envíos
  const contratosPorTerminar = facturas.filter((f) => fin(f) === periodo || fin(f) === sumarMeses(periodo, 1));
  const conProgramacion = new Set(d.programaciones.filter((p) => p.estado === 'ACTIVO').map((p) => p.facturaId));
  const sinProgramacion = facturas.filter((f) => fin(f) >= periodo && !conProgramacion.has(f.id));
  const cotizacionesPendientes = d.cotizaciones.filter((c) => c.estado === 'PENDIENTE');
  const enviosFallidos = d.envios.filter((e) => e.estado === 'FALLIDO' && diasEntre(e.fecha.slice(0, 10), hoy) <= DIAS_AGENDA);

  const pendientes: PendienteTablero[] = [
    {
      id: 'mora',
      nivel: 'CRITICA',
      icono: 'fa-solid fa-hand-holding-dollar',
      titulo: 'Acudientes en mora',
      detalle: `${pesos.format(suma(vencidas))} en ${plural(vencidas.length, 'cuota vencida', 'cuotas vencidas')}`,
      cantidad: acudientesEnMora,
      enlace: '/finanzas/reportes-financieros/morosos',
    },
    {
      id: 'vehiculos-vencidos',
      nivel: 'CRITICA',
      icono: 'fa-solid fa-bus',
      titulo: 'Vehículos con documentos vencidos',
      detalle: 'No se pueden asignar a rutas hasta renovarlos',
      cantidad: vehiculosVencidos,
      enlace: '/operacion/vehiculos',
    },
    {
      id: 'licencias-vencidas',
      nivel: 'CRITICA',
      icono: 'fa-solid fa-id-card',
      titulo: 'Conductores con licencia vencida',
      detalle: 'No pueden tener rutas asignadas',
      cantidad: licenciasVencidas,
      enlace: '/operacion/conductores',
    },
    {
      id: 'envios-fallidos',
      nivel: 'CRITICA',
      icono: 'fa-solid fa-paper-plane',
      titulo: 'Recordatorios de cobro fallidos',
      detalle: `En los últimos ${DIAS_AGENDA} días; revisa los datos de contacto`,
      cantidad: enviosFallidos.length,
      enlace: '/finanzas/programacion-facturacion',
    },
    {
      id: 'sin-ruta',
      nivel: 'ADVERTENCIA',
      icono: 'fa-solid fa-user-graduate',
      titulo: 'Estudiantes activos sin ruta',
      detalle: 'Agrégalos a una ruta de su colegio y jornada',
      cantidad: sinRuta.length,
      enlace: '/operacion/rutas',
    },
    {
      id: 'rutas-sin-asignacion',
      nivel: 'ADVERTENCIA',
      icono: 'fa-solid fa-route',
      titulo: 'Rutas sin vehículo ni conductor',
      detalle: 'Crea su asignación en Operación',
      cantidad: rutas.filter((r) => !asignaciones.some((a) => a.rutaId === r.id)).length,
      enlace: '/operacion/asignaciones',
    },
    {
      id: 'vehiculos-por-vencer',
      nivel: 'ADVERTENCIA',
      icono: 'fa-solid fa-file-shield',
      titulo: 'Vehículos con documentos por vencer',
      detalle: 'SOAT, técnico-mecánica, tarjeta de operación o pólizas en los próximos 30 días',
      cantidad: vehiculosPorVencer,
      enlace: '/operacion/vehiculos',
    },
    {
      id: 'licencias-por-vencer',
      nivel: 'ADVERTENCIA',
      icono: 'fa-solid fa-id-card',
      titulo: 'Licencias por vencer',
      detalle: 'Vencen en los próximos 30 días',
      cantidad: licenciasPorVencer,
      enlace: '/operacion/conductores',
    },
    {
      id: 'contratos-por-terminar',
      nivel: 'ADVERTENCIA',
      icono: 'fa-solid fa-file-signature',
      titulo: 'Contratos por terminar',
      detalle: 'Terminan este mes o el siguiente; crea la nueva factura si continúan',
      cantidad: contratosPorTerminar.length,
      enlace: '/finanzas/facturas',
    },
    {
      id: 'sin-programacion',
      nivel: 'INFORMATIVA',
      icono: 'fa-solid fa-calendar-xmark',
      titulo: 'Facturas sin recordatorio de cobro',
      detalle: 'No tienen una programación de facturación activa',
      cantidad: sinProgramacion.length,
      enlace: '/finanzas/programacion-facturacion',
    },
    {
      id: 'cotizaciones',
      nivel: 'INFORMATIVA',
      icono: 'fa-solid fa-file-lines',
      titulo: 'Cotizaciones pendientes de respuesta',
      detalle: pesos.format(cotizacionesPendientes.reduce((s, c) => s + c.valorTotal, 0)) + ' en total',
      cantidad: cotizacionesPendientes.length,
      enlace: '/finanzas/cotizaciones',
    },
  ].filter((p): p is PendienteTablero => p.cantidad > 0);

  // Agenda de los próximos días
  const enAgenda = (fecha: string) => !!fecha && fecha >= hoy && fecha <= limiteAgenda;
  const agenda: EventoAgenda[] = [];
  for (const v of vehiculos) {
    for (const [campo, nombre] of DOCUMENTOS_VEHICULO) {
      if (enAgenda(v[campo])) {
        agenda.push({ fecha: v[campo], tipo: 'DOCUMENTO', titulo: `Vence ${nombre}`, detalle: `Vehículo ${v.placa} · interno ${v.numeroInterno}`, enlace: '/operacion/vehiculos' });
      }
    }
  }
  for (const c of conductores) {
    if (enAgenda(c.vencimientoLicencia)) {
      agenda.push({ fecha: c.vencimientoLicencia, tipo: 'LICENCIA', titulo: 'Vence licencia de conducción', detalle: nombreCompleto(c), enlace: '/operacion/conductores' });
    }
  }
  const cuotasPorFecha = new Map<string, CuotaPendiente[]>();
  for (const c of porVencer.filter((c) => enAgenda(c.fechaLimite))) {
    cuotasPorFecha.set(c.fechaLimite, [...(cuotasPorFecha.get(c.fechaLimite) ?? []), c]);
  }
  for (const [fecha, cuotas] of cuotasPorFecha) {
    agenda.push({
      fecha,
      tipo: 'PAGO',
      titulo: 'Fecha límite de pago',
      detalle: `${plural(cuotas.length, 'cuota pendiente', 'cuotas pendientes')} · ${pesos.format(suma(cuotas))}`,
      enlace: '/finanzas/reportes-financieros/facturas-pendientes',
    });
  }
  for (const f of contratosPorTerminar) {
    const fecha = diaDelPeriodo(fin(f), 31);
    if (enAgenda(fecha)) {
      agenda.push({ fecha, tipo: 'CONTRATO', titulo: `Termina contrato ${f.numero}`, detalle: `${f.nombreEstudiante} · ${nombrePeriodo(fin(f))}`, enlace: '/finanzas/facturas' });
    }
  }
  agenda.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Colegios
  const colegioPorId = new Map(d.colegios.map((c) => [c.id, c.razonSocial]));
  const porColegio = new Map<string, number>();
  for (const e of estudiantes) porColegio.set(e.colegioId, (porColegio.get(e.colegioId) ?? 0) + 1);

  return {
    periodo,
    recaudo: {
      recaudado: suma(recaudadoDe(periodo)),
      esperado: esperado(periodo),
      pagos: new Set(recaudadoDe(periodo).map((r) => r.id)).size,
      anterior: suma(recaudadoDe(sumarMeses(periodo, -1))),
    },
    cartera: {
      vencida: suma(vencidas),
      cuotasVencidas: vencidas.length,
      acudientesEnMora,
      porVencer: suma(porVencer),
    },
    estudiantes: {
      activos: estudiantes.length,
      sinRuta: sinRuta.length,
      nuevosMes: estudiantes.filter((e) => e.fechaCreacion?.startsWith(periodo)).length,
      colegios: porColegio.size,
    },
    operacion: {
      rutasActivas: rutas.length,
      rutasSinAsignacion: pendientes.find((p) => p.id === 'rutas-sin-asignacion')?.cantidad ?? 0,
      vehiculosActivos: vehiculos.length,
      conductoresActivos: conductores.length,
      ocupacion: cupos ? Math.round((conVehiculo.reduce((s, r) => s + r.estudiantes, 0) / cupos) * 100) : null,
    },
    pendientes,
    agenda,
    ultimosPagos: [...recibos]
      .sort((a, b) => b.fechaPago.localeCompare(a.fechaPago) || (b.fechaCreacion ?? '').localeCompare(a.fechaCreacion ?? ''))
      .slice(0, 5)
      .map(({ id, numero, nombreAcudiente, nombreEstudiante, periodo: p, fechaPago, valor, medioPago }) => ({
        id, numero, nombreAcudiente, nombreEstudiante, periodo: p, fechaPago, valor, medioPago,
      })),
    historico: Array.from({ length: 12 }, (_, i) => {
      const p = sumarMeses(periodo, i - 11);
      return { periodo: p, facturado: esperado(p), recaudado: suma(recaudadoDe(p)) };
    }),
    estudiantesPorColegio: [...porColegio.entries()]
      .map(([id, cantidad]) => ({ colegio: colegioPorId.get(id) ?? 'Sin colegio', cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad),
    ocupacionRutas,
  };
}

function porcentaje(r: { estudiantes: number; capacidad: number | null }): number {
  return r.capacidad ? r.estudiantes / r.capacidad : -1;
}
