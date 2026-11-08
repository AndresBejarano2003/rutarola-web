/**
 * Planes y suscripción de la empresa (contrato: `Application/Suscripciones` del API).
 * Quien se registra tiene 3 meses del plan Profesional; al terminar sin pagar pasa a Gratis (conserva sus
 * datos; solo se limita crear o activar vehículos y estudiantes por encima del plan). El anual = 10 meses.
 */
export type PlanSuscripcion = 'GRATIS' | 'ESENCIAL' | 'PROFESIONAL' | 'EMPRESARIAL';
export type EstadoSuscripcion = 'PRUEBA' | 'ACTIVA' | 'GRATIS';
export type PeriodoPago = 'MENSUAL' | 'ANUAL';
export type EstadoPagoSuscripcion = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO' | 'ERROR';

/** Funciones que dependen del plan. */
export const FUNCIONES_PLAN = {
  GPS_EN_VIVO: 'GPS_EN_VIVO',
  RECORDATORIOS: 'RECORDATORIOS',
  SOPORTE_PRIORITARIO: 'SOPORTE_PRIORITARIO',
  ACOMPANAMIENTO: 'ACOMPANAMIENTO',
} as const;

/** `null` = sin límite. */
export interface LimitesPlan {
  vehiculos: number | null;
  estudiantes: number | null;
}

export interface Plan {
  id: PlanSuscripcion;
  nombre: string;
  descripcion: string;
  precioMensual: number;
  precioAnual: number;
  /** "Desde": el valor final depende del tamaño de la flota. */
  precioDesde: boolean;
  destacado: boolean;
  limites: LimitesPlan;
  funciones: string[];
  incluye: string[];
}

export interface Suscripcion {
  plan: PlanSuscripcion;
  nombrePlan: string;
  estado: EstadoSuscripcion;
  periodo: PeriodoPago | '';
  fechaInicio: string;
  fechaFin: string | null;
  diasRestantes: number | null;
  pruebaUsada: boolean;
  limites: LimitesPlan;
  uso: { vehiculos: number; estudiantes: number };
  funciones: string[];
  pagosEnLinea: boolean;
  nota: string;
}

export interface PagoSuscripcion {
  id: string;
  referencia: string;
  plan: PlanSuscripcion;
  periodo: PeriodoPago;
  /** Pesos. */
  valor: number;
  estado: EstadoPagoSuscripcion;
  metodoPago: string;
  idTransaccion: string;
  fechaCreacion: string;
  fechaAplicacion: string | null;
}

export interface Checkout {
  referencia: string;
  /** Web Checkout de Wompi con la firma de integridad calculada en el servidor. */
  url: string;
  valorCentavos: number;
}

export interface AjusteSuscripcion {
  plan: PlanSuscripcion;
  estado: EstadoSuscripcion;
  periodo: PeriodoPago | '';
  /** ISO 8601; `''` en Gratis. */
  fechaFin: string;
  nota: string;
}

export const MESES_PRUEBA = 3;
export const MESES_PAGADOS_POR_ANIO = 10;

const BASE = [
  'Ruta del día para conductor y monitora con asistencia por estudiante',
  'Estudiantes, acudientes, colegios, rutas y vehículos',
  'Facturas, recibos y estado de cuenta',
  'Portal del acudiente con sus pagos y estudiantes',
  'Alertas de documentos y licencias por vencer',
];

/** Copia del catálogo del API (`CatalogoPlanes.cs`) para el modo local y mientras carga. */
export const PLANES: Plan[] = [
  {
    id: 'GRATIS',
    nombre: 'Gratis',
    descripcion: 'Para empezar a organizar una ruta sin costo.',
    precioMensual: 0,
    precioAnual: 0,
    precioDesde: false,
    destacado: false,
    limites: { vehiculos: 1, estudiantes: 20 },
    funciones: [],
    incluye: [...BASE, 'Soporte por tickets'],
  },
  {
    id: 'ESENCIAL',
    nombre: 'Esencial',
    descripcion: 'Para pequeñas empresas que quieren cobrar a tiempo.',
    precioMensual: 89_900,
    precioAnual: 899_000,
    precioDesde: false,
    destacado: false,
    limites: { vehiculos: 5, estudiantes: 120 },
    funciones: [FUNCIONES_PLAN.RECORDATORIOS],
    incluye: [
      'Todo lo del plan Gratis',
      'Recordatorios automáticos de cobro por correo y WhatsApp',
      'Reportes de ingresos, cartera y morosos con exportación a CSV',
      'Tablero con indicadores del mes',
    ],
  },
  {
    id: 'PROFESIONAL',
    nombre: 'Profesional',
    descripcion: 'Para empresas en crecimiento que quieren dar tranquilidad a las familias.',
    precioMensual: 189_900,
    precioAnual: 1_899_000,
    precioDesde: false,
    destacado: true,
    limites: { vehiculos: 15, estudiantes: 400 },
    funciones: [FUNCIONES_PLAN.RECORDATORIOS, FUNCIONES_PLAN.GPS_EN_VIVO, FUNCIONES_PLAN.SOPORTE_PRIORITARIO],
    incluye: [
      'Todo lo del plan Esencial',
      'GPS en vivo desde los teléfonos del conductor y la monitora',
      'Mapa del recorrido para los acudientes',
      'Monitoreo de todas las rutas en tiempo real e historial con trayecto',
      'Soporte prioritario',
    ],
  },
  {
    id: 'EMPRESARIAL',
    nombre: 'Empresarial',
    descripcion: 'Para flotas grandes o varias sedes.',
    precioMensual: 389_900,
    precioAnual: 3_899_000,
    precioDesde: true,
    destacado: false,
    limites: { vehiculos: null, estudiantes: null },
    funciones: [FUNCIONES_PLAN.RECORDATORIOS, FUNCIONES_PLAN.GPS_EN_VIVO, FUNCIONES_PLAN.SOPORTE_PRIORITARIO, FUNCIONES_PLAN.ACOMPANAMIENTO],
    incluye: [
      'Todo lo del plan Profesional',
      'Vehículos y estudiantes sin límite',
      'Capacitación del equipo y acompañamiento en la puesta en marcha',
      'Atención de incidentes críticos en 8 horas',
    ],
  },
];

export const ORDEN_PLAN: Record<PlanSuscripcion, number> = { GRATIS: 0, ESENCIAL: 1, PROFESIONAL: 2, EMPRESARIAL: 3 };

export const ESTADOS_SUSCRIPCION: { id: EstadoSuscripcion; nombre: string }[] = [
  { id: 'PRUEBA', nombre: 'Prueba gratuita' },
  { id: 'ACTIVA', nombre: 'Activa (pagada)' },
  { id: 'GRATIS', nombre: 'Plan Gratis' },
];

export const ESTADOS_PAGO: Record<EstadoPagoSuscripcion, { nombre: string; badge: string }> = {
  PENDIENTE: { nombre: 'Pendiente', badge: 'badge-warning' },
  APROBADO: { nombre: 'Aprobado', badge: 'badge-success' },
  RECHAZADO: { nombre: 'Rechazado', badge: 'badge-error' },
  ANULADO: { nombre: 'Anulado', badge: 'bg-base-300' },
  ERROR: { nombre: 'Error', badge: 'badge-error' },
};

export function nombrePlan(plan: PlanSuscripcion): string {
  return PLANES.find((p) => p.id === plan)?.nombre ?? plan;
}

/** Valor mensual equivalente del plan anual (para mostrar el ahorro). */
export function mensualEquivalente(p: Plan): number {
  return Math.round(p.precioAnual / 12);
}

/** Lo que cuesta al mes por estudiante con el cupo completo (argumento de precio accesible). */
export function costoPorEstudiante(p: Plan): number | null {
  return p.precioMensual > 0 && p.limites.estudiantes ? Math.round(p.precioMensual / p.limites.estudiantes) : null;
}

/** La redirección de Wompi agrega `?id=<transacción>` a la URL de retorno; dentro del hash puede quedar pegado al parámetro. */
export function leerRetornoPago(pago: string | null, id: string | null): { referencia: string; idTransaccion: string } | null {
  if (!pago) return null;
  const [referencia, resto = ''] = pago.split('?');
  const idPegado = /(?:^|&)id=([^&]+)/.exec(resto)?.[1] ?? '';
  return { referencia, idTransaccion: id ?? decodeURIComponent(idPegado) };
}
