import { Factura } from 'src/app/finanzas/facturas/factura';
import { Programacion } from 'src/app/finanzas/programacion/programacion';
import { Recibo } from 'src/app/finanzas/recibos/recibo';
import { fechaLimiteCuota } from 'src/app/finanzas/reportes/reportes';
import { Asignacion } from 'src/app/operacion/asignaciones/asignacion';
import { Colegio } from 'src/app/operacion/colegios/colegio';
import { Ruta } from 'src/app/operacion/rutas/ruta';
import { Vehiculo } from 'src/app/operacion/vehiculos/vehiculo';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { Empleado } from 'src/app/personas/empleados/empleado';
import { AvisoAusencia } from 'src/app/ruta-del-dia/avisos-ausencia';
import { Recorrido, Trayecto } from 'src/app/ruta-del-dia/recorrido';
import { diaDelPeriodo, nombrePeriodo } from 'src/app/shared/fechas/fechas';
import {
  Cronograma,
  DetalleDiaCronograma,
  DiaCronograma,
  EstadoTrayectoCronograma,
  EventoCronograma,
  RutaCronograma,
  esHabil,
  sumarDiasCronograma,
} from './cronograma';

/** Lo que necesita el cronograma (en modo local, los registros del navegador). */
export interface DatosCronograma {
  rutas: Ruta[];
  asignaciones: Asignacion[];
  recorridos: Recorrido[];
  avisos: AvisoAusencia[];
  vehiculos: Vehiculo[];
  empleados: Empleado[];
  colegios: Colegio[];
  facturas: Factura[];
  recibos: Recibo[];
  programaciones: Programacion[];
  /** `YYYY-MM-DD` */
  hoy: string;
}

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const DOCUMENTOS = [
  { campo: 'vencimientoSoat', nombre: 'SOAT' },
  { campo: 'vencimientoTecnomecanica', nombre: 'Técnico-mecánica' },
  { campo: 'vencimientoTarjetaOperacion', nombre: 'Tarjeta de operación' },
  { campo: 'vencimientoPolizas', nombre: 'Pólizas' },
] as const;

const cubre = (a: Asignacion, d: string) => a.fechaInicio <= d && (!a.fechaFin || a.fechaFin >= d);
const activas = (d: DatosCronograma) => d.rutas.filter((r) => r.estado === 'ACTIVO');
const asignacionesActivas = (d: DatosCronograma) => d.asignaciones.filter((a) => a.estado === 'ACTIVO');

function rutasDelDia(datos: DatosCronograma, fecha: string): Ruta[] {
  if (!esHabil(fecha)) return [];
  const asignaciones = asignacionesActivas(datos);
  return activas(datos).filter((r) => asignaciones.some((a) => a.rutaId === r.id && cubre(a, fecha)));
}

function eventos(datos: DatosCronograma, fecha: string): EventoCronograma[] {
  const nivelVence = fecha < datos.hoy ? 'CRITICA' : 'ADVERTENCIA';
  const lista: EventoCronograma[] = [];
  for (const v of datos.vehiculos.filter((x) => x.estado === 'ACTIVO')) {
    for (const doc of DOCUMENTOS) {
      if (v[doc.campo] === fecha) {
        lista.push({ tipo: 'DOCUMENTO', nivel: nivelVence, titulo: `Vence ${doc.nombre}`, detalle: `Vehículo ${v.placa} · interno ${v.numeroInterno}`, enlace: '/operacion/vehiculos' });
      }
    }
  }
  for (const c of datos.empleados.filter((e) => e.estado === 'ACTIVO' && e.tipoEmpleado === 'CONDUCTOR' && e.vencimientoLicencia === fecha)) {
    lista.push({ tipo: 'LICENCIA', nivel: nivelVence, titulo: 'Vence licencia de conducción', detalle: nombreCompleto(c), enlace: '/operacion/conductores' });
  }
  // Fecha límite de pago de cada mensualidad.
  const periodo = fecha.slice(0, 7);
  const vigentes = datos.facturas.filter((f) => f.estado === 'ACTIVO');
  const cuotas = vigentes.filter((f) => {
    if (periodo < f.periodoInicio || periodo > f.periodoFin) return false;
    const dia = datos.programaciones.find((p) => p.facturaId === f.id)?.diaLimitePago;
    return fechaLimiteCuota(periodo, dia || undefined) === fecha;
  });
  if (cuotas.length) {
    const pendientes = cuotas.filter((f) => !datos.recibos.some((r) => r.estado === 'ACTIVO' && r.facturaId === f.id && r.periodo === periodo));
    lista.push({
      tipo: 'PAGO',
      nivel: pendientes.length === 0 ? 'INFORMATIVA' : fecha < datos.hoy ? 'CRITICA' : 'ADVERTENCIA',
      titulo: 'Fecha límite de pago',
      detalle: `${plural(cuotas.length, 'cuota', 'cuotas')} · ${plural(pendientes.length, 'pendiente', 'pendientes')} · ${pesos.format(pendientes.reduce((s, f) => s + f.valorContratacion, 0))}`,
      enlace: '/finanzas/reportes-financieros/facturas-pendientes',
    });
  }
  for (const f of vigentes.filter((x) => diaDelPeriodo(x.periodoFin, 31) === fecha)) {
    lista.push({ tipo: 'CONTRATO', nivel: 'INFORMATIVA', titulo: `Termina contrato ${f.numero}`, detalle: `${f.nombreEstudiante} · ${nombrePeriodo(f.periodoFin)}`, enlace: '/finanzas/facturas' });
  }
  for (const a of asignacionesActivas(datos).filter((x) => x.fechaFin === fecha)) {
    const ruta = activas(datos).find((r) => r.id === a.rutaId);
    if (!ruta) continue;
    const conductor = datos.empleados.find((e) => e.id === a.conductorId);
    lista.push({
      tipo: 'FIN_ASIGNACION',
      nivel: 'INFORMATIVA',
      titulo: `Termina la asignación de ${ruta.codigo}`,
      detalle: `${ruta.nombre} · ${conductor ? nombreCompleto(conductor) : ''}`,
      enlace: '/operacion/asignaciones',
    });
  }
  return lista;
}

/** Igual que `ServicioCronograma.ObtenerAsync`. */
export function calcularCronograma(datos: DatosCronograma, desde: string, hasta: string): Cronograma {
  const dias: DiaCronograma[] = [];
  for (let d = desde; d <= hasta; d = sumarDiasCronograma(d, 1)) {
    const recorridos = datos.recorridos.filter((r) => r.fecha === d);
    const rutas = new Set([...rutasDelDia(datos, d).map((r) => r.id), ...recorridos.map((r) => r.rutaId)]);
    dias.push({
      fecha: d,
      habil: esHabil(d),
      rutas: rutas.size,
      finalizados: recorridos.filter((r) => r.estado === 'FINALIZADO').length,
      enCurso: recorridos.filter((r) => r.estado === 'EN_CURSO').length,
      ausencias: datos.avisos.filter((a) => a.fecha === d).length,
      eventos: eventos(datos, d),
    });
  }
  return { desde, hasta, dias };
}

const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

/** Igual que `ServicioCronograma.DiaAsync`. */
export function calcularDiaCronograma(datos: DatosCronograma, fecha: string): DetalleDiaCronograma {
  const recorridos = datos.recorridos.filter((r) => r.fecha === fecha);
  const avisos = datos.avisos.filter((a) => a.fecha === fecha);
  const conRecorrido = new Set(recorridos.map((r) => r.rutaId));
  const lista = [...rutasDelDia(datos, fecha), ...activas(datos).filter((r) => conRecorrido.has(r.id))];
  const unicas = lista.filter((r, i) => lista.findIndex((x) => x.id === r.id) === i);
  const nombre = (id: string) => {
    const e = datos.empleados.find((x) => x.id === id);
    return e ? nombreCompleto(e) : '';
  };
  const rutas = unicas
    .sort((a, b) => a.jornada.localeCompare(b.jornada) || a.codigo.localeCompare(b.codigo))
    .map((r): RutaCronograma => {
      const asignacion = asignacionesActivas(datos).find((a) => a.rutaId === r.id && cubre(a, fecha));
      const estudiantes = new Set(r.estudianteIds);
      const trayectos = (['RECOGIDA', 'ENTREGA'] as Trayecto[]).map((t) => {
        const rec = recorridos.find((x) => x.rutaId === r.id && x.trayecto === t);
        const estado: EstadoTrayectoCronograma = !rec ? (fecha < datos.hoy ? 'SIN_REGISTRO' : 'PROGRAMADO') : rec.estado;
        return { trayecto: t, estado, recorridoId: rec?.id ?? '', horaInicio: hora(rec?.inicio), horaFin: hora(rec?.fin) };
      });
      return {
        rutaId: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        jornada: r.jornada,
        colegio: datos.colegios.find((c) => c.id === r.colegioId)?.razonSocial ?? '',
        vehiculo: asignacion ? (datos.vehiculos.find((v) => v.id === asignacion.vehiculoId)?.placa ?? '') : '',
        conductor: asignacion ? nombre(asignacion.conductorId) : '',
        monitora: asignacion?.monitoraId ? nombre(asignacion.monitoraId) : '',
        estudiantes: estudiantes.size,
        ausencias: avisos.filter((a) => estudiantes.has(a.estudianteId)).length,
        trayectos,
      };
    });
  const ausencias = avisos
    .map((a) => ({
      id: a.id,
      estudiante: a.estudiante,
      ruta: activas(datos)
        .filter((r) => r.estudianteIds.includes(a.estudianteId))
        .map((r) => r.codigo)
        .join(', '),
      trayecto: a.trayecto,
      motivo: a.motivo,
      nota: a.nota,
      acudiente: a.acudiente,
      confirmadoPor: a.confirmado ? a.confirmadoPor : '',
    }))
    .sort((a, b) => a.ruta.localeCompare(b.ruta) || a.estudiante.localeCompare(b.estudiante));
  return { fecha, habil: esHabil(fecha), rutas, ausencias, eventos: eventos(datos, fecha) };
}
