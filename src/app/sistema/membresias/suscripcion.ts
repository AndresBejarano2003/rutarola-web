/**
 * Planes y suscripción de la empresa (contrato: `Application/Suscripciones` del API).
 * Quien se registra elige cómo empezar (`ComienzoRegistro`): el plan Gratis (no vence: sigue en Gratis hasta que pague
 * un plan o inicie la prueba), la prueba del plan Profesional con los días que fija la plataforma (15 por defecto; cada
 * empresa conserva los que recibió) o pagar un plan de una vez. El plan o la prueba duran hasta el final de su último día:
 * desde los días de aviso que fija la plataforma se avisa a todos los administradores, y al día siguiente, sin pago, la
 * empresa queda en Gratis automáticamente (se inactiva lo que supere los límites). El anual = 10 meses. Los precios los
 * fija la plataforma (`GET /suscripcion/planes`); `PLANES` es la copia por defecto.
 */
export type PlanSuscripcion = 'GRATIS' | 'ESENCIAL' | 'PROFESIONAL' | 'EMPRESARIAL';
export type EstadoSuscripcion = 'PRUEBA' | 'ACTIVA' | 'GRATIS';
export type PeriodoPago = 'MENSUAL' | 'ANUAL';
/** Registro: `GRATIS` (plan Gratis sin vencimiento), `PRUEBA` (días de Profesional) o `PAGAR` (Gratis + pago del plan elegido). */
export type ComienzoRegistro = 'GRATIS' | 'PRUEBA' | 'PAGAR';
export type EstadoPagoSuscripcion = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO' | 'ERROR';

/** Funciones que dependen del plan. */
export const FUNCIONES_PLAN = {
  GPS_EN_VIVO: 'GPS_EN_VIVO',
  RECORDATORIOS: 'RECORDATORIOS',
  SOPORTE_PRIORITARIO: 'SOPORTE_PRIORITARIO',
  ACOMPANAMIENTO: 'ACOMPANAMIENTO',
  REPORTES: 'REPORTES',
  CRONOGRAMA: 'CRONOGRAMA',
} as const;
export type FuncionPlan = (typeof FUNCIONES_PLAN)[keyof typeof FUNCIONES_PLAN];

/** Para los mensajes "Tu plan Gratis no incluye …" (igual que `FuncionPlan.Nombre`). */
export const NOMBRES_FUNCION: Record<FuncionPlan, string> = {
  GPS_EN_VIVO: 'el GPS en vivo',
  RECORDATORIOS: 'los recordatorios automáticos de cobro',
  SOPORTE_PRIORITARIO: 'el soporte prioritario',
  ACOMPANAMIENTO: 'el acompañamiento',
  REPORTES: 'los reportes financieros',
  CRONOGRAMA: 'el cronograma de la operación',
};

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
  /** Plan que venció (`''` si no aplica) y cuándo: al día siguiente quedó en Gratis. */
  planVencido: PlanSuscripcion | '';
  fechaVencimiento: string | null;
  /** Días de prueba que recibió la empresa al registrarse (0 = sin prueba o anterior). */
  diasPrueba: number;
}

/** `GET /suscripcion/condiciones` (público). */
export interface CondicionesRegistro {
  diasPrueba: number;
  /** Desde cuántos días antes del fin del plan se avisa (parámetro de la plataforma). */
  diasAvisoVencimiento: number;
  planPrueba: PlanSuscripcion;
  nombrePlanPrueba: string;
}

/** Parámetro global de la plataforma (Plataforma › Ajustes). */
export interface ParametroPlataforma {
  clave: string;
  nombre: string;
  descripcion: string;
  valor: string;
  minimo: number;
  maximo: number;
  /** `DIAS` o `PESOS`. */
  tipo: 'DIAS' | 'PESOS';
  /** `MEMBRESIAS` (prueba y avisos) o `PRECIOS` (valor mensual de cada plan pagado). */
  grupo: 'MEMBRESIAS' | 'PRECIOS';
}

export const CLAVE_DIAS_PRUEBA = 'suscripcion.dias_prueba';
export const CLAVE_DIAS_AVISO_VENCIMIENTO = 'suscripcion.dias_aviso_vencimiento';
export const DIAS_AVISO_VENCIMIENTO_POR_DEFECTO = 5;
/** `plan.esencial.precio_mensual` … (pesos con IVA). */
export function clavePrecio(plan: PlanSuscripcion): string {
  return `plan.${plan.toLowerCase()}.precio_mensual`;
}

/** Situación de la membresía en la tabla de la plataforma (`ServicioSuscripcion.Situacion`). */
export type SituacionMembresia = 'PRUEBA' | 'PRUEBA_POR_VENCER' | 'ACTIVA' | 'POR_VENCER' | 'GRATIS';

export interface MembresiaEmpresa {
  plan: PlanSuscripcion;
  nombrePlan: string;
  estado: EstadoSuscripcion;
  situacion: SituacionMembresia;
  periodo: PeriodoPago | '';
  fechaInicio: string;
  fechaFin: string | null;
  diasRestantes: number | null;
  diasPrueba: number;
  planVencido: PlanSuscripcion | '';
  fechaVencimiento: string | null;
  fechaUltimoPago: string | null;
}

export const SITUACIONES_MEMBRESIA: { id: SituacionMembresia; nombre: string; badge: string; icono: string; descripcion: string }[] = [
  { id: 'PRUEBA', nombre: 'En prueba', badge: 'badge-info', icono: 'fa-solid fa-flask', descripcion: 'Prueba gratuita vigente' },
  { id: 'PRUEBA_POR_VENCER', nombre: 'Prueba por vencer', badge: 'badge-warning', icono: 'fa-solid fa-hourglass-half', descripcion: 'Le quedan 3 días o menos' },
  { id: 'ACTIVA', nombre: 'Al día', badge: 'badge-success', icono: 'fa-solid fa-circle-check', descripcion: 'Plan pagado vigente' },
  { id: 'POR_VENCER', nombre: 'Por vencer', badge: 'badge-warning', icono: 'fa-solid fa-clock', descripcion: 'Vence en 7 días o menos' },
  { id: 'GRATIS', nombre: 'Gratis', badge: 'bg-base-300', icono: 'fa-solid fa-seedling', descripcion: 'Plan Gratis (elegido o tras vencer sin pago)' },
];

export function situacionMembresia(id: SituacionMembresia) {
  return SITUACIONES_MEMBRESIA.find((s) => s.id === id) ?? SITUACIONES_MEMBRESIA[0];
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
  /** `''` sin código. */
  codigoPromocional: string;
  /** Pesos descontados del primer mes. */
  descuento: number;
}

export interface Checkout {
  referencia: string;
  /** Web Checkout de Wompi con la firma de integridad calculada en el servidor. `''` si el código cubrió todo y el plan ya quedó activo. */
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
  /** Opcional (solo ACTIVA): registra el uso del código y anota el descuento del primer mes en la nota. */
  codigoPromocional?: string;
  /** Opcional (solo ACTIVA), pesos: lo que pagó por fuera; queda como pago MANUAL y cuenta en los ingresos. 0 = sin pago. */
  valorPagado?: number;
}

/** Días de prueba por defecto (la plataforma los cambia; `GET /suscripcion/condiciones`). */
export const DIAS_PRUEBA_POR_DEFECTO = 15;
export const MESES_PAGADOS_POR_ANIO = 10;

const BASE = [
  'Ruta del día para conductor y monitora con asistencia por estudiante',
  'Estudiantes, acudientes, colegios, rutas y vehículos',
  'Facturas, recibos y estado de cuenta',
  'Portal del acudiente con sus pagos y estudiantes',
  'Alertas de documentos y licencias por vencer',
  'Tablero con indicadores del mes',
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
    funciones: [FUNCIONES_PLAN.RECORDATORIOS, FUNCIONES_PLAN.REPORTES],
    incluye: [
      'Todo lo del plan Gratis',
      'Recordatorios automáticos de cobro por correo y WhatsApp',
      'Reportes de ingresos, cartera y morosos con exportación a CSV',
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
    funciones: [
      FUNCIONES_PLAN.RECORDATORIOS,
      FUNCIONES_PLAN.REPORTES,
      FUNCIONES_PLAN.GPS_EN_VIVO,
      FUNCIONES_PLAN.SOPORTE_PRIORITARIO,
      FUNCIONES_PLAN.CRONOGRAMA,
    ],
    incluye: [
      'Todo lo del plan Esencial',
      'GPS en vivo desde los teléfonos del conductor y la monitora',
      'Cronograma de rutas, ausencias y vencimientos por semana, mes y año',
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
    funciones: [
      FUNCIONES_PLAN.RECORDATORIOS,
      FUNCIONES_PLAN.REPORTES,
      FUNCIONES_PLAN.GPS_EN_VIVO,
      FUNCIONES_PLAN.SOPORTE_PRIORITARIO,
      FUNCIONES_PLAN.CRONOGRAMA,
      FUNCIONES_PLAN.ACOMPANAMIENTO,
    ],
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

/** El plan más barato que incluye la función. */
export function planDesdeConFuncion(funcion: FuncionPlan, planes: Plan[] = PLANES): Plan {
  return planes.find((p) => p.funciones.includes(funcion)) ?? planes[planes.length - 1];
}

/** "Tu plan Gratis no incluye los reportes financieros. Está disponible desde el plan Esencial." */
export function mensajeFuncionBloqueada(funcion: FuncionPlan, planActual: string): string {
  return `Tu plan ${planActual} no incluye ${NOMBRES_FUNCION[funcion]}. Está disponible desde el plan ${planDesdeConFuncion(funcion).nombre}.`;
}

/** Cuánto quedaría inactivo al pasar a `plan` con el uso actual (se conservan primero los que están en uso). */
export function excedentes(s: Pick<Suscripcion, 'uso'>, plan: Plan): { vehiculos: number; estudiantes: number } {
  const sobra = (usados: number, limite: number | null) => (limite === null ? 0 : Math.max(0, usados - limite));
  return { vehiculos: sobra(s.uso.vehiculos, plan.limites.vehiculos), estudiantes: sobra(s.uso.estudiantes, plan.limites.estudiantes) };
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

/** Desde este porcentaje de un límite se avisa que está cerca. */
export const PORCENTAJE_CERCA_DEL_LIMITE = 80;
export type NivelUso = 'NORMAL' | 'CERCA' | 'LLENO';

/** Qué tan lleno está un límite del plan (`null` = sin límite → NORMAL). */
export function nivelUso(usados: number, limite: number | null): NivelUso {
  if (!limite) return 'NORMAL';
  const porcentaje = (usados / limite) * 100;
  return porcentaje >= 100 ? 'LLENO' : porcentaje >= PORCENTAJE_CERCA_DEL_LIMITE ? 'CERCA' : 'NORMAL';
}

/** Empresa en Gratis que nunca usó la prueba (se registró en Gratis): puede iniciarla (`POST /suscripcion/prueba`). */
export function puedeIniciarPrueba(s: Pick<Suscripcion, 'estado' | 'pruebaUsada'> | null): boolean {
  return !!s && s.estado === 'GRATIS' && !s.pruebaUsada;
}

/**
 * Recordatorio del plan Gratis para el shell del administrador (aviso, insignia FREE y menú): el nivel lo da el límite
 * más lleno, para que "Llegaste al límite" se vea antes que el recordatorio general. null fuera de Gratis.
 */
export function recordatorioGratis(s: Suscripcion | null): { nivel: NivelUso; texto: string } | null {
  if (!s || s.estado !== 'GRATIS') return null;
  const limites = [
    { nivel: nivelUso(s.uso.vehiculos, s.limites.vehiculos), texto: `${s.uso.vehiculos} de ${s.limites.vehiculos} vehículo(s)` },
    { nivel: nivelUso(s.uso.estudiantes, s.limites.estudiantes), texto: `${s.uso.estudiantes} de ${s.limites.estudiantes} estudiantes` },
  ];
  const llenos = limites.filter((l) => l.nivel === 'LLENO');
  if (llenos.length) {
    return { nivel: 'LLENO', texto: `Llegaste al límite del plan Gratis (${llenos.map((l) => l.texto).join(' y ')}). Mejora tu plan para registrar más.` };
  }
  const cerca = limites.filter((l) => l.nivel === 'CERCA');
  if (cerca.length) {
    return { nivel: 'CERCA', texto: `Estás cerca del límite del plan Gratis: usas ${cerca.map((l) => l.texto).join(' y ')}.` };
  }
  const extra = puedeIniciarPrueba(s) ? ` o prueba el plan Profesional gratis` : '';
  return {
    nivel: 'NORMAL',
    texto: `Estás en el plan Gratis (hasta ${s.limites.vehiculos} vehículo(s) y ${s.limites.estudiantes} estudiantes). Mejora tu plan${extra} para tener GPS en vivo, recordatorios de cobro y reportes.`,
  };
}

/** Fecha `YYYY-MM-DD` de Colombia de un instante ISO (el último día del plan). */
export function diaColombia(iso: string): string {
  return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

/** Hoy en Colombia (`YYYY-MM-DD`). */
export function hoyColombia(ahora = Date.now()): string {
  return new Date(ahora - 5 * 3_600_000).toISOString().slice(0, 10);
}

/** Días hasta el último día del plan (0 = vence hoy; dura hasta el final de ese día). Igual que `ServicioSuscripcion.DiasRestantes`. */
export function diasHastaFin(fechaFin: string, ahora = Date.now()): number {
  const dia = (f: string) => Date.parse(`${f}T00:00:00Z`) / 86_400_000;
  return Math.max(0, Math.round(dia(diaColombia(fechaFin)) - dia(hoyColombia(ahora))));
}

/** Venció si ya pasó su último día (Colombia): al día siguiente queda en Gratis. Igual que `ServicioSuscripcion.VencidaEn`. */
export function planVencido(s: Pick<Suscripcion, 'estado' | 'fechaFin'>, ahora = Date.now()): boolean {
  return s.estado !== 'GRATIS' && (!s.fechaFin || diaColombia(s.fechaFin) < hoyColombia(ahora));
}

/** Los planes con los precios que fijó la plataforma (anual = 10 mensualidades). */
export function conPrecios(precios: Partial<Record<PlanSuscripcion, number>>, planes: Plan[] = PLANES): Plan[] {
  return planes.map((p) => {
    const mensual = precios[p.id];
    return p.precioMensual > 0 && mensual ? { ...p, precioMensual: mensual, precioAnual: mensual * MESES_PAGADOS_POR_ANIO } : p;
  });
}
