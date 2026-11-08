import { ArchivoAdjunto } from 'src/app/shared/archivo-adjunto/archivo-adjunto';

/**
 * Tickets de soporte (mismas reglas que `Application/Soporte/ReglasTicket.cs` del API):
 *
 * NUEVO → EN_REVISION → EN_PROCESO → EN_QA → EN_PRUEBAS → VALIDACION_CLIENTE → RESUELTO → CERRADO
 * con ESPERANDO_CLIENTE (se pidió información; responder lo devuelve a revisión), devoluciones a una etapa
 * anterior, RECHAZADO (no procede) y CANCELADO (la empresa desiste mientras no esté resuelto).
 * Errores y mejoras pasan SIEMPRE por QA, pruebas y la validación del cliente. Un RESUELTO sin respuesta se
 * cierra solo a los 7 días.
 */
export type TipoTicket = 'ERROR' | 'CONSULTA' | 'MEJORA' | 'CAPACITACION';
export type PrioridadTicket = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type EstadoTicket =
  | 'NUEVO'
  | 'EN_REVISION'
  | 'ESPERANDO_CLIENTE'
  | 'EN_PROCESO'
  | 'EN_QA'
  | 'EN_PRUEBAS'
  | 'VALIDACION_CLIENTE'
  | 'RESUELTO'
  | 'CERRADO'
  | 'RECHAZADO'
  | 'CANCELADO';
export type TipoEventoTicket =
  | 'CREADO'
  | 'CAMBIO_ESTADO'
  | 'COMENTARIO'
  | 'NOTA_INTERNA'
  | 'ASIGNACION'
  | 'CAMBIO_PRIORIDAD'
  | 'REUNION'
  | 'CALIFICACION';
export type ModalidadReunion = 'VIRTUAL' | 'PRESENCIAL' | 'LLAMADA';
export type EstadoReunion = 'PROGRAMADA' | 'REALIZADA' | 'CANCELADA';

export interface AdjuntoTicket {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
}

export interface EventoTicket {
  id: string;
  tipo: TipoEventoTicket;
  estadoAnterior: EstadoTicket | null;
  estadoNuevo: EstadoTicket | null;
  texto: string;
  interno: boolean;
  deLaPlataforma: boolean;
  usuario: string;
  /** ISO 8601 UTC. */
  fecha: string;
  adjuntos: AdjuntoTicket[];
}

export interface ReunionTicket {
  id: string;
  fecha: string;
  duracionMinutos: number;
  modalidad: ModalidadReunion;
  enlace: string;
  motivo: string;
  estado: EstadoReunion;
  notas: string;
  organizador: string;
}

export interface AccionesCliente {
  comentar: boolean;
  cancelar: boolean;
  validar: boolean;
  confirmar: boolean;
  reabrir: boolean;
}

/** Fila de los listados. `responsableId` `''` = sin asignar. */
export interface TicketResumen {
  id: string;
  numero: string;
  empresaId: string;
  empresa: string;
  tipo: TipoTicket;
  modulo: string;
  prioridad: PrioridadTicket;
  asunto: string;
  estado: EstadoTicket;
  solicitante: string;
  responsableId: string;
  responsable: string;
  fechaCreacion: string;
  fechaUltimaActividad: string;
  fechaObjetivo: string;
  vencido: boolean;
  proximaReunion: string | null;
}

/** Detalle. La empresa no recibe notas internas; `siguientesEstados` solo para la plataforma, `acciones` solo para la empresa. */
export interface Ticket extends TicketResumen {
  descripcion: string;
  correoSolicitante: string;
  fechaPrimeraRespuesta: string | null;
  fechaResolucion: string | null;
  fechaCierre: string | null;
  calificacion: number | null;
  comentarioCalificacion: string;
  adjuntos: AdjuntoTicket[];
  eventos: EventoTicket[];
  reuniones: ReunionTicket[];
  siguientesEstados: EstadoTicket[];
  acciones: AccionesCliente;
}

export interface ResumenTickets {
  porEstado: Record<EstadoTicket, number>;
  abiertos: number;
  vencidos: number;
  sinAsignar: number;
  reunionesProximas: number;
}

export interface Responsable {
  id: string;
  nombre: string;
}

/** `estado`: un estado, `ABIERTOS` o `FINALIZADOS`; `responsableId`: un id o `SIN_ASIGNAR`; `empresaId` solo plataforma. */
export interface FiltrosTicket {
  texto: string;
  estado: string;
  prioridad: string;
  tipo: string;
  empresaId: string;
  responsableId: string;
  vencidos: boolean;
}

export const FILTROS_TICKET_VACIOS: FiltrosTicket = {
  texto: '',
  estado: '',
  prioridad: '',
  tipo: '',
  empresaId: '',
  responsableId: '',
  vencidos: false,
};

export interface SolicitudTicket {
  tipo: TipoTicket;
  modulo: string;
  prioridad: PrioridadTicket;
  asunto: string;
  descripcion: string;
  adjuntos: ArchivoAdjunto[];
}

export interface SolicitudReunion {
  /** ISO 8601. */
  fecha: string;
  duracionMinutos: number;
  modalidad: ModalidadReunion;
  enlace: string;
  motivo: string;
}

export const MAXIMO_ADJUNTOS_TICKET = 3;
export const TAMANO_MAXIMO_ADJUNTO_MB = 1;
export const DIAS_CIERRE_AUTOMATICO = 7;

const HORA = 3_600_000;
/** Tiempo objetivo de solución (SLA) desde la creación. */
export const OBJETIVO_MS: Record<PrioridadTicket, number> = {
  CRITICA: 8 * HORA,
  ALTA: 24 * HORA,
  MEDIA: 72 * HORA,
  BAJA: 7 * 24 * HORA,
};

export const FINALIZADOS: readonly EstadoTicket[] = ['CERRADO', 'RECHAZADO', 'CANCELADO'];
const SIN_VENCIMIENTO: readonly EstadoTicket[] = ['RESUELTO', ...FINALIZADOS];

export function vencido(estado: EstadoTicket, fechaObjetivo: string, ahora = new Date()): boolean {
  return !SIN_VENCIMIENTO.includes(estado) && ahora.getTime() > new Date(fechaObjetivo).getTime();
}

export function requiereCalidad(tipo: TipoTicket): boolean {
  return tipo === 'ERROR' || tipo === 'MEJORA';
}

const TRANSICIONES: Record<EstadoTicket, EstadoTicket[]> = {
  NUEVO: ['EN_REVISION', 'RECHAZADO'],
  EN_REVISION: ['EN_PROCESO', 'ESPERANDO_CLIENTE', 'RESUELTO', 'RECHAZADO'],
  ESPERANDO_CLIENTE: ['EN_REVISION', 'EN_PROCESO'],
  EN_PROCESO: ['EN_QA', 'ESPERANDO_CLIENTE', 'EN_REVISION', 'RESUELTO'],
  EN_QA: ['EN_PRUEBAS', 'EN_PROCESO'],
  EN_PRUEBAS: ['VALIDACION_CLIENTE', 'EN_PROCESO'],
  VALIDACION_CLIENTE: ['RESUELTO', 'EN_PROCESO'],
  RESUELTO: ['CERRADO', 'EN_REVISION'],
  CERRADO: [],
  RECHAZADO: [],
  CANCELADO: [],
};

export function siguientesEstados(estado: EstadoTicket, tipo: TipoTicket): EstadoTicket[] {
  return TRANSICIONES[estado].filter((s) => !(s === 'RESUELTO' && requiereCalidad(tipo) && estado !== 'VALIDACION_CLIENTE'));
}

function etapa(e: EstadoTicket): number {
  const etapas: Partial<Record<EstadoTicket, number>> = {
    NUEVO: 0,
    EN_REVISION: 1,
    ESPERANDO_CLIENTE: 1,
    EN_PROCESO: 2,
    EN_QA: 3,
    EN_PRUEBAS: 4,
    VALIDACION_CLIENTE: 5,
    RESUELTO: 6,
  };
  return etapas[e] ?? 7;
}

/** Rechazar, pedir información, resolver o devolver a una etapa anterior exige explicar por qué. */
export function requiereComentario(desde: EstadoTicket, hacia: EstadoTicket): boolean {
  return hacia === 'RECHAZADO' || hacia === 'ESPERANDO_CLIENTE' || hacia === 'RESUELTO' || etapa(hacia) < etapa(desde);
}

export function accionesCliente(estado: EstadoTicket): AccionesCliente {
  const abierto = !FINALIZADOS.includes(estado);
  return {
    comentar: abierto,
    cancelar: abierto && estado !== 'RESUELTO',
    validar: estado === 'VALIDACION_CLIENTE',
    confirmar: estado === 'RESUELTO',
    reabrir: estado === 'RESUELTO',
  };
}

// --- Presentación -------------------------------------------------------------------------------

export interface InfoEstado {
  nombre: string;
  /** Nombre para la empresa (cuando difiere). */
  nombreCliente?: string;
  /** Clase del badge (`badge-soft` + color). */
  badge: string;
  icono: string;
  /** Texto del botón de la plataforma para llevar el ticket a este estado. */
  accion: string;
}

export const ESTADOS_TICKET: Record<EstadoTicket, InfoEstado> = {
  NUEVO: { nombre: 'Nuevo', badge: 'badge-info', icono: 'fa-solid fa-inbox', accion: 'Nuevo' },
  EN_REVISION: { nombre: 'En revisión', badge: 'badge-info', icono: 'fa-solid fa-magnifying-glass', accion: 'Tomar y revisar' },
  ESPERANDO_CLIENTE: {
    nombre: 'Esperando a la empresa',
    nombreCliente: 'Esperando tu respuesta',
    badge: 'badge-warning',
    icono: 'fa-solid fa-hourglass-half',
    accion: 'Pedir información',
  },
  EN_PROCESO: { nombre: 'En proceso', badge: 'badge-secondary', icono: 'fa-solid fa-screwdriver-wrench', accion: 'Pasar a desarrollo' },
  EN_QA: { nombre: 'Control de calidad (QA)', badge: 'badge-secondary', icono: 'fa-solid fa-clipboard-check', accion: 'Enviar a QA' },
  EN_PRUEBAS: { nombre: 'En pruebas', badge: 'badge-secondary', icono: 'fa-solid fa-vial', accion: 'Enviar a pruebas' },
  VALIDACION_CLIENTE: {
    nombre: 'Validación de la empresa',
    nombreCliente: 'Pendiente de tu validación',
    badge: 'badge-warning',
    icono: 'fa-solid fa-user-check',
    accion: 'Pedir validación a la empresa',
  },
  RESUELTO: { nombre: 'Resuelto', badge: 'badge-success', icono: 'fa-solid fa-circle-check', accion: 'Marcar resuelto' },
  CERRADO: { nombre: 'Cerrado', badge: 'bg-base-300', icono: 'fa-solid fa-lock', accion: 'Cerrar' },
  RECHAZADO: { nombre: 'Rechazado', badge: 'badge-error', icono: 'fa-solid fa-ban', accion: 'Rechazar' },
  CANCELADO: { nombre: 'Cancelado', badge: 'bg-base-300', icono: 'fa-solid fa-xmark', accion: 'Cancelar' },
};

/** Etapas del avance normal, para la barra de progreso del detalle. */
export const ETAPAS_TICKET: { estado: EstadoTicket; nombre: string }[] = [
  { estado: 'NUEVO', nombre: 'Recibido' },
  { estado: 'EN_REVISION', nombre: 'Revisión' },
  { estado: 'EN_PROCESO', nombre: 'Proceso' },
  { estado: 'EN_QA', nombre: 'QA' },
  { estado: 'EN_PRUEBAS', nombre: 'Pruebas' },
  { estado: 'VALIDACION_CLIENTE', nombre: 'Validación' },
  { estado: 'RESUELTO', nombre: 'Resuelto' },
  { estado: 'CERRADO', nombre: 'Cerrado' },
];

export function indiceEtapa(estado: EstadoTicket): number {
  return estado === 'ESPERANDO_CLIENTE' ? 1 : ETAPAS_TICKET.findIndex((e) => e.estado === estado);
}

export function nombreEstado(estado: EstadoTicket, paraCliente = false): string {
  const info = ESTADOS_TICKET[estado];
  return (paraCliente && info.nombreCliente) || info.nombre;
}

export const TIPOS_TICKET: { id: TipoTicket; nombre: string; icono: string }[] = [
  { id: 'ERROR', nombre: 'Error', icono: 'fa-solid fa-bug' },
  { id: 'CONSULTA', nombre: 'Consulta', icono: 'fa-solid fa-circle-question' },
  { id: 'MEJORA', nombre: 'Mejora', icono: 'fa-solid fa-lightbulb' },
  { id: 'CAPACITACION', nombre: 'Capacitación', icono: 'fa-solid fa-chalkboard-user' },
];

export const PRIORIDADES_TICKET: { id: PrioridadTicket; nombre: string; badge: string }[] = [
  { id: 'BAJA', nombre: 'Baja', badge: 'bg-base-300' },
  { id: 'MEDIA', nombre: 'Media', badge: 'badge-info' },
  { id: 'ALTA', nombre: 'Alta', badge: 'badge-warning' },
  { id: 'CRITICA', nombre: 'Crítica', badge: 'badge-error' },
];

export const MODALIDADES_REUNION: { id: ModalidadReunion; nombre: string; icono: string }[] = [
  { id: 'VIRTUAL', nombre: 'Videollamada', icono: 'fa-solid fa-video' },
  { id: 'LLAMADA', nombre: 'Llamada', icono: 'fa-solid fa-phone' },
  { id: 'PRESENCIAL', nombre: 'Presencial', icono: 'fa-solid fa-handshake' },
];

export function nombreTipo(tipo: TipoTicket): string {
  return TIPOS_TICKET.find((t) => t.id === tipo)?.nombre ?? tipo;
}

export function nombrePrioridad(p: PrioridadTicket): string {
  return PRIORIDADES_TICKET.find((x) => x.id === p)?.nombre ?? p;
}

export function badgePrioridad(p: PrioridadTicket): string {
  return PRIORIDADES_TICKET.find((x) => x.id === p)?.badge ?? 'bg-base-300';
}

export function nombreModalidad(m: ModalidadReunion): string {
  return MODALIDADES_REUNION.find((x) => x.id === m)?.nombre ?? m;
}

/** Opciones del filtro de estado (incluye los grupos ABIERTOS / FINALIZADOS). */
export function opcionesEstado(paraCliente = false): { id: string; nombre: string }[] {
  return [
    { id: 'ABIERTOS', nombre: 'Abiertos (sin terminar)' },
    { id: 'FINALIZADOS', nombre: 'Terminados' },
    ...(Object.keys(ESTADOS_TICKET) as EstadoTicket[]).map((e) => ({ id: e, nombre: nombreEstado(e, paraCliente) })),
  ];
}
