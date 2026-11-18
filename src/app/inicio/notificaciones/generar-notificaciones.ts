import { Cotizacion } from 'src/app/finanzas/cotizaciones/cotizacion';
import { Factura } from 'src/app/finanzas/facturas/factura';
import { EnvioProgramado, Programacion } from 'src/app/finanzas/programacion/programacion';
import { unirMeses } from 'src/app/finanzas/cuotas';
import { MEDIOS_PAGO, Recibo, mesesRecibo } from 'src/app/finanzas/recibos/recibo';
import { Moroso } from 'src/app/finanzas/reportes/reportes';
import { TIPOS_VEHICULO, Vehiculo } from 'src/app/operacion/vehiculos/vehiculo';
import { NovedadVehiculo, TipoNovedadVehiculo } from 'src/app/operacion/vehiculos/novedades-vehiculo/novedad-vehiculo';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { Empleado } from 'src/app/personas/empleados/empleado';
import { diasEntre, fechaCorta, fechaIso, nombrePeriodo, periodoDe, sumarMeses } from 'src/app/shared/fechas/fechas';
import { estadoVencimiento } from 'src/app/shared/vencimiento/vencimiento';
import { Suscripcion, diaColombia, nombrePlan, planVencido } from 'src/app/sistema/membresias/suscripcion';
import { NuevaNotificacion } from './notificacion-sistema';

/**
 * Reglas que deciden QUÉ se notifica. Hoy las ejecuta el modo local; con API las debe aplicar el
 * servidor (por evento y en un proceso diario). Son puras: reciben los datos y la fecha actual.
 */

/** Los eventos (registros nuevos, pagos, envíos) solo se notifican si ocurrieron en estos días. */
export const VENTANA_EVENTOS_DIAS = 30;

export interface DatosNotificables {
  vehiculos: Vehiculo[];
  empleados: Empleado[];
  facturas: Factura[];
  recibos: Recibo[];
  cotizaciones: Cotizacion[];
  envios: { programacion: Programacion; envio: EnvioProgramado }[];
  morosos: Moroso[];
  /** Novedades de los vehículos (las del personal que siguen abiertas se notifican). */
  novedades?: NovedadVehiculo[];
  /** Plan de la empresa y desde cuántos días antes de vencer se avisa (parámetro de la plataforma). */
  suscripcion?: Suscripcion | null;
  diasAvisoVencimiento?: number;
}

/** Nombres cortos para el título (iguales a `GeneradorNotificaciones.NombreNovedad`). */
const NOMBRES_NOVEDAD: Record<TipoNovedadVehiculo, string> = {
  AVERIA: 'Avería',
  DANO: 'Daño',
  LLANTAS: 'Llantas',
  MANTENIMIENTO: 'Mantenimiento',
  LIMPIEZA: 'Aseo',
  DOCUMENTOS: 'Documentos',
  OTRO: 'Otra',
};

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const DOCUMENTOS_VEHICULO = [
  { campo: 'vencimientoSoat', nombre: 'SOAT', femenino: false },
  { campo: 'vencimientoTecnomecanica', nombre: 'Revisión técnico-mecánica', femenino: true },
  { campo: 'vencimientoTarjetaOperacion', nombre: 'Tarjeta de operación', femenino: true },
  { campo: 'vencimientoPolizas', nombre: 'Pólizas', femenino: true, plural: true },
] as const;

export function generarNotificaciones(datos: DatosNotificables, ahora = new Date()): NuevaNotificacion[] {
  const hoy = fechaIso(ahora);
  const reciente = (iso: string | undefined) => !!iso && diasEntre(iso.slice(0, 10), hoy) <= VENTANA_EVENTOS_DIAS;
  const resultado: NuevaNotificacion[] = [];
  const agregar = (n: NuevaNotificacion) => resultado.push(n);

  // Pagos recibidos
  for (const r of datos.recibos) {
    const fecha = r.fechaCreacion ?? `${r.fechaPago}T12:00:00`;
    if (r.estado !== 'ACTIVO' || !reciente(fecha)) continue;
    const medio = MEDIOS_PAGO.find((m) => m.id === r.medioPago)?.nombre ?? r.medioPago;
    agregar({
      clave: `recibo:${r.id}`,
      categoria: 'PAGOS',
      nivel: 'EXITO',
      titulo: `Pago recibido · ${r.numero}`,
      mensaje: `${r.nombreAcudiente} pagó ${pesos.format(r.valor)} de ${unirMeses([...new Set(mesesRecibo(r).map((m) => m.periodo))].sort()) || nombrePeriodo(r.periodo, true)} por ${r.nombreEstudiante} (factura ${r.numeroFactura}). Medio de pago: ${medio}.`,
      fecha,
      enlace: '/finanzas/recibos',
      textoEnlace: 'Ver recibos',
    });
  }

  // Acudientes en mora (la clave cambia si se vence otra cuota → nueva notificación)
  for (const m of datos.morosos) {
    agregar({
      clave: `mora:${m.acudienteId}:${m.periodos.join(',')}`,
      categoria: 'PAGOS',
      nivel: 'CRITICA',
      titulo: `Acudiente en mora · ${m.nombreAcudiente}`,
      mensaje: `${m.nombreAcudiente} debe ${m.cuotas} ${m.cuotas === 1 ? 'cuota' : 'cuotas'} por ${pesos.format(m.valorAdeudado)} (${m.periodos.map((p) => nombrePeriodo(p)).join(', ')}). La más antigua tiene ${m.diasMoraMaxima} días de mora.`,
      enlace: '/finanzas/reportes-financieros/morosos',
      textoEnlace: 'Ver reporte de morosos',
    });
  }

  // Facturas nuevas y contratos por terminar / terminados
  const periodoActual = periodoDe(ahora);
  for (const f of datos.facturas) {
    const fecha = f.fechaCreacion ?? `${f.fechaEmision}T12:00:00`;
    if (reciente(fecha)) {
      agregar({
        clave: `factura:${f.id}`,
        categoria: 'FACTURACION',
        nivel: 'INFORMATIVA',
        titulo: `Nueva factura · ${f.numero}`,
        mensaje: `${f.nombreAcudiente} — ${f.nombreEstudiante}: ${pesos.format(f.valorContratacion)} mensuales de ${nombrePeriodo(f.periodoInicio, true)} a ${nombrePeriodo(f.periodoFin, true)}.`,
        fecha,
        enlace: '/finanzas/facturas',
        textoEnlace: 'Ver facturas',
      });
    }
    // Con retiro el fin es una decisión ya tomada: no se avisa como contrato por terminar.
    if (f.estado !== 'ACTIVO' || !f.periodoFin || f.periodoRetiro) continue;
    if (f.periodoFin === periodoActual || f.periodoFin === sumarMeses(periodoActual, 1)) {
      agregar({
        clave: `factura-termina:${f.id}:${f.periodoFin}`,
        categoria: 'FACTURACION',
        nivel: 'ADVERTENCIA',
        titulo: `Contrato por terminar · ${f.numero}`,
        mensaje: `El contrato de ${f.nombreEstudiante} (acudiente ${f.nombreAcudiente}) termina en ${nombrePeriodo(f.periodoFin, true)}. Si el servicio continúa, crea una nueva factura para los meses siguientes.`,
        enlace: '/finanzas/facturas',
        textoEnlace: 'Ver facturas',
      });
    } else if (f.periodoFin < periodoActual) {
      agregar({
        clave: `factura-terminada:${f.id}:${f.periodoFin}`,
        categoria: 'FACTURACION',
        nivel: 'INFORMATIVA',
        titulo: `Contrato terminado · ${f.numero}`,
        mensaje: `El contrato de ${f.nombreEstudiante} (acudiente ${f.nombreAcudiente}) terminó en ${nombrePeriodo(f.periodoFin, true)} y la factura sigue vigente. Crea una nueva si el servicio continúa o cámbiala a Inactiva.`,
        enlace: '/finanzas/facturas',
        textoEnlace: 'Ver facturas',
      });
    }
  }

  // Cotizaciones nuevas y su respuesta
  for (const c of datos.cotizaciones) {
    const fecha = c.fechaCreacion ?? `${c.fecha}T12:00:00`;
    const estudiantes = `${c.estudiantes.length} ${c.estudiantes.length === 1 ? 'estudiante' : 'estudiantes'}`;
    if (reciente(fecha)) {
      agregar({
        clave: `cotizacion:${c.id}`,
        categoria: 'COTIZACIONES',
        nivel: 'INFORMATIVA',
        titulo: `Nueva cotización · ${c.numero}`,
        mensaje: `${c.nombreAcudiente}: ${estudiantes} por ${pesos.format(c.valorTotal)} en total.`,
        fecha,
        enlace: '/finanzas/cotizaciones',
        textoEnlace: 'Ver cotizaciones',
      });
    }
    if (c.estado !== 'PENDIENTE' && reciente(c.fechaActualizacion)) {
      const aprobada = c.estado === 'APROBADA';
      agregar({
        clave: `cotizacion-${c.estado.toLowerCase()}:${c.id}`,
        categoria: 'COTIZACIONES',
        nivel: aprobada ? 'EXITO' : 'INFORMATIVA',
        titulo: `Cotización ${aprobada ? 'aprobada' : 'rechazada'} · ${c.numero}`,
        mensaje: aprobada
          ? `${c.nombreAcudiente} aprobó la cotización (${estudiantes}, ${pesos.format(c.valorTotal)}). Siguiente paso: registrar la factura.`
          : `${c.nombreAcudiente} rechazó la cotización (${estudiantes}, ${pesos.format(c.valorTotal)}).`,
        fecha: c.fechaActualizacion,
        enlace: aprobada ? '/finanzas/facturas' : '/finanzas/cotizaciones',
        textoEnlace: aprobada ? 'Crear factura' : 'Ver cotizaciones',
      });
    }
  }

  // Novedades del vehículo reportadas por el conductor o la monitora (las que siguen abiertas)
  for (const n of datos.novedades ?? []) {
    if (!n.delPersonal || n.estado === 'RESUELTA' || !reciente(n.fechaCreacion)) continue;
    const placa = n.vehiculo.split(' · ')[0];
    const descripcion = n.descripcion.length <= 160 ? n.descripcion : `${n.descripcion.slice(0, 159).trimEnd()}…`;
    agregar({
      clave: `novedad-vehiculo:${n.id}`,
      categoria: 'OPERACION',
      nivel: n.gravedad === 'ALTA' ? 'CRITICA' : 'ADVERTENCIA',
      titulo: `Novedad en el vehículo ${placa} · ${NOMBRES_NOVEDAD[n.tipo]}`,
      mensaje: `${n.reporta} reportó: ${descripcion}${n.gravedad === 'ALTA' ? ' Gravedad alta: revisa si el vehículo puede salir.' : ''}`,
      fecha: n.fechaCreacion,
      enlace: `/operacion/vehiculos?novedad=${n.id}`,
      textoEnlace: 'Ver novedad',
    });
  }

  // Vehículos: registro y documentos
  for (const v of datos.vehiculos) {
    if (reciente(v.fechaCreacion)) {
      const tipo = TIPOS_VEHICULO.find((t) => t.id === v.tipo)?.nombre ?? v.tipo;
      agregar({
        clave: `vehiculo:${v.id}`,
        categoria: 'OPERACION',
        nivel: 'INFORMATIVA',
        titulo: `Vehículo registrado · ${v.placa}`,
        mensaje: `${tipo} ${v.marca} ${v.linea} modelo ${v.modelo}, interno ${v.numeroInterno}, con capacidad para ${v.capacidad} pasajeros.`,
        fecha: v.fechaCreacion,
        enlace: '/operacion/vehiculos',
        textoEnlace: 'Ver vehículos',
      });
    }
    if (v.estado !== 'ACTIVO') continue;
    for (const doc of DOCUMENTOS_VEHICULO) {
      const vence = v[doc.campo];
      const estado = estadoVencimiento(vence, ahora);
      if (estado !== 'POR_VENCER' && estado !== 'VENCIDA') continue;
      const vencido = estado === 'VENCIDA';
      const palabra = vencido
        ? `vencid${doc.femenino ? 'a' : 'o'}${'plural' in doc ? 's' : ''}`
        : 'por vencer';
      const dias = Math.abs(diasEntre(hoy, vence));
      agregar({
        clave: `veh-doc:${v.id}:${doc.campo}:${vence}:${estado}`,
        categoria: 'VENCIMIENTOS',
        nivel: vencido ? 'CRITICA' : 'ADVERTENCIA',
        titulo: `${doc.nombre} ${palabra} · ${v.placa}`,
        mensaje: vencido
          ? `${doc.nombre} del vehículo ${v.placa} (interno ${v.numeroInterno}) ${'plural' in doc ? 'vencieron' : 'venció'} el ${fechaCorta(vence)}, hace ${dias} ${dias === 1 ? 'día' : 'días'}. Un vehículo con documentos vencidos no se puede asignar a rutas.`
          : `${doc.nombre} del vehículo ${v.placa} (interno ${v.numeroInterno}) ${'plural' in doc ? 'vencen' : 'vence'} el ${fechaCorta(vence)}, en ${dias} ${dias === 1 ? 'día' : 'días'}. Renuévalo a tiempo para no afectar las rutas.`,
        enlace: '/operacion/vehiculos',
        textoEnlace: 'Ver vehículos',
      });
    }
  }

  // Empleados: registro y licencias de conductores
  for (const e of datos.empleados) {
    const nombre = nombreCompleto(e);
    if (reciente(e.fechaCreacion)) {
      agregar({
        clave: `empleado:${e.id}`,
        categoria: 'PERSONAS',
        nivel: 'INFORMATIVA',
        titulo: `Empleado registrado · ${nombre}`,
        mensaje: `${nombre} (${e.tipoDocumento} ${e.numeroDocumento}) fue registrado como ${e.tipoEmpleado.toLowerCase()}.`,
        fecha: e.fechaCreacion,
        enlace: '/personas/empleados',
        textoEnlace: 'Ver empleados',
      });
    }
    if (e.estado !== 'ACTIVO' || e.tipoEmpleado !== 'CONDUCTOR') continue;
    const estado = estadoVencimiento(e.vencimientoLicencia, ahora);
    if (estado !== 'POR_VENCER' && estado !== 'VENCIDA') continue;
    const vencida = estado === 'VENCIDA';
    const dias = Math.abs(diasEntre(hoy, e.vencimientoLicencia));
    agregar({
      clave: `licencia:${e.id}:${e.vencimientoLicencia}:${estado}`,
      categoria: 'VENCIMIENTOS',
      nivel: vencida ? 'CRITICA' : 'ADVERTENCIA',
      titulo: `Licencia ${vencida ? 'vencida' : 'por vencer'} · ${nombre}`,
      mensaje: vencida
        ? `La licencia de conducción de ${nombre} (${e.categoriaLicencia} ${e.numeroLicencia}) venció el ${fechaCorta(e.vencimientoLicencia)}, hace ${dias} ${dias === 1 ? 'día' : 'días'}. No puede tener rutas asignadas hasta renovarla.`
        : `La licencia de conducción de ${nombre} (${e.categoriaLicencia} ${e.numeroLicencia}) vence el ${fechaCorta(e.vencimientoLicencia)}, en ${dias} ${dias === 1 ? 'día' : 'días'}.`,
      enlace: '/operacion/conductores',
      textoEnlace: 'Ver conductores',
    });
  }

  // Envíos automáticos de la programación de facturación
  for (const { programacion, envio } of datos.envios) {
    if (!reciente(envio.fecha)) continue;
    const canal = envio.canal === 'WHATSAPP' ? 'WhatsApp' : 'correo';
    const fallido = envio.estado === 'FALLIDO';
    agregar({
      clave: `envio:${envio.id}`,
      categoria: 'ENVIOS',
      nivel: fallido ? 'CRITICA' : 'INFORMATIVA',
      titulo: fallido ? `Falló un envío por ${canal}` : `Recordatorio enviado por ${canal}`,
      mensaje: fallido
        ? `No se pudo enviar el recordatorio de ${nombrePeriodo(envio.periodo, true)} de "${programacion.nombre}" (factura ${programacion.numeroFactura}) a ${envio.destinatario}: ${envio.detalle} Revisa los datos de contacto del acudiente.`
        : `Se envió el recordatorio de ${nombrePeriodo(envio.periodo, true)} de "${programacion.nombre}" (factura ${programacion.numeroFactura}) a ${envio.destinatario}.`,
      fecha: envio.fecha,
      enlace: '/finanzas/programacion-facturacion',
      textoEnlace: 'Ver programación',
    });
  }

  if (datos.suscripcion) {
    resultado.push(...avisosMembresia(datos.suscripcion, hoy, datos.diasAvisoVencimiento ?? 5, ahora));
  }
  return resultado;
}

/** Suma días a `YYYY-MM-DD`. */
function masDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Igual que `GeneradorNotificaciones.AvisosMembresia`: desde `diasAviso` días antes del último día del plan o de la prueba
 * ("vence en N días"), el último día ("vence hoy", crítica) y, ya en Gratis, "Tu plan X venció" durante 30 días.
 * El servidor además manda el aviso por correo a cada administrador.
 */
export function avisosMembresia(s: Suscripcion, hoy: string, diasAviso: number, ahora = new Date()): NuevaNotificacion[] {
  const enlace = '/sistema/membership';
  const resultado: NuevaNotificacion[] = [];
  if (s.estado !== 'GRATIS' && s.fechaFin && !planVencido(s, ahora.getTime())) {
    const ultimo = diaColombia(s.fechaFin);
    const dias = diasEntre(hoy, ultimo);
    const nombre = nombrePlan(s.plan);
    const que = s.estado === 'PRUEBA' ? `Tu prueba gratuita del plan ${nombre}` : `Tu plan ${nombre}`;
    const consecuencia = `Si no pagas, desde el ${fechaCorta(masDias(ultimo, 1))} quedas en el plan Gratis: se desactivan las funciones de tu plan y se inactivan los vehículos y estudiantes que superen sus límites (no se borra nada).`;
    const clave = `membresia:${s.estado.toLowerCase()}:${ultimo}`;
    if (dias === 0) {
      resultado.push({
        clave: `${clave}:ultimo-dia`,
        categoria: 'SISTEMA',
        nivel: 'CRITICA',
        titulo: `${que} vence hoy`,
        mensaje: `${que} termina hoy ${fechaCorta(ultimo)}. ${consecuencia}`,
        enlace,
        textoEnlace: 'Ver planes',
      });
    } else if (dias <= diasAviso) {
      resultado.push({
        clave: `${clave}:por-vencer`,
        categoria: 'SISTEMA',
        nivel: 'ADVERTENCIA',
        titulo: `${que} vence en ${dias} ${dias === 1 ? 'día' : 'días'}`,
        mensaje: `${que} termina el ${fechaCorta(ultimo)}. ${consecuencia}`,
        enlace,
        textoEnlace: 'Ver planes',
      });
    }
  }
  if (s.estado === 'GRATIS' && s.planVencido && s.fechaVencimiento) {
    const ultimo = diaColombia(s.fechaVencimiento);
    if (diasEntre(ultimo, hoy) <= VENTANA_EVENTOS_DIAS) {
      const nombre = nombrePlan(s.planVencido);
      resultado.push({
        clave: `membresia:vencida:${s.planVencido.toLowerCase()}:${ultimo}`,
        categoria: 'SISTEMA',
        nivel: 'CRITICA',
        titulo: `Tu plan ${nombre} venció: ahora estás en Gratis`,
        mensaje: `Tu plan ${nombre} terminó el ${fechaCorta(ultimo)} sin pago y desde el ${fechaCorta(masDias(ultimo, 1))} estás en el plan Gratis. Los vehículos y estudiantes que superaban sus límites quedaron inactivos (no se borró nada). Paga un plan para recuperar sus funciones.`,
        enlace,
        textoEnlace: 'Mejorar mi plan',
      });
    }
  }
  return resultado;
}
