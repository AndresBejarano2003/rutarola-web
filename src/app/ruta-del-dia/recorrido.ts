import type { AvisoParada } from './avisos-ausencia';
import { Entidad } from 'src/app/shared/crud/crud';

/**
 * Sentido del recorrido:
 * - `RECOGIDA`: casa → colegio. Se recoge a cada estudiante en su casa y se entregan todos en el colegio.
 * - `ENTREGA`: colegio → casa. Abordan en el colegio y se entrega cada uno en su casa (orden inverso).
 */
export type Trayecto = 'RECOGIDA' | 'ENTREGA';

export const TRAYECTOS: { id: Trayecto; nombre: string; descripcion: string; icono: string }[] = [
  { id: 'RECOGIDA', nombre: 'Recogida', descripcion: 'De la casa al colegio', icono: 'fa-solid fa-house-chimney-user' },
  { id: 'ENTREGA', nombre: 'Entrega', descripcion: 'Del colegio a la casa', icono: 'fa-solid fa-school' },
];

/** PENDIENTE → A_BORDO → ENTREGADO, o PENDIENTE → AUSENTE. */
export type EstadoParada = 'PENDIENTE' | 'A_BORDO' | 'ENTREGADO' | 'AUSENTE';

export const ESTADOS_PARADA: Record<EstadoParada, { nombre: string; badge: string; icono: string }> = {
  PENDIENTE: { nombre: 'Pendiente', badge: 'bg-base-300 text-base-content', icono: 'fa-solid fa-clock' },
  A_BORDO: { nombre: 'A bordo', badge: 'badge-soft badge-info', icono: 'fa-solid fa-bus' },
  ENTREGADO: { nombre: 'Entregado', badge: 'badge-soft badge-success', icono: 'fa-solid fa-circle-check' },
  AUSENTE: { nombre: 'No asistió', badge: 'badge-soft badge-warning', icono: 'fa-solid fa-user-slash' },
};

/**
 * Por qué no viaja (solo con estado AUSENTE; `''` = sin motivo):
 * - `NO_ASISTE`: no va al colegio hoy. Se marca en la RECOGIDA y la ENTREGA de ese día ya lo trae ausente.
 * - `POR_SU_CUENTA`: sí asiste, pero no viaja en la ruta en ese trayecto (lo lleva o lo recoge su acudiente).
 */
export type MotivoAusencia = 'NO_ASISTE' | 'POR_SU_CUENTA';

/** Texto del estado AUSENTE según el motivo y el trayecto (igual a `NombreAusencia` del API). */
export function nombreAusencia(motivo: MotivoAusencia | '', trayecto: Trayecto): string {
  if (motivo === 'NO_ASISTE') return 'No asiste hoy al colegio';
  if (trayecto === 'ENTREGA') return 'No viaja en la ruta';
  return motivo === 'POR_SU_CUENTA' ? 'Va al colegio por su cuenta' : 'No asistió';
}

/** Cambios permitidos (incluye "deshacer" hacia el estado anterior). */
const TRANSICIONES: Record<EstadoParada, EstadoParada[]> = {
  PENDIENTE: ['A_BORDO', 'AUSENTE'],
  A_BORDO: ['ENTREGADO', 'PENDIENTE'],
  ENTREGADO: ['A_BORDO'],
  AUSENTE: ['PENDIENTE'],
};

export function transicionPermitida(desde: EstadoParada, hacia: EstadoParada): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

/** Estudiante del recorrido. Guarda los datos COMO ESTABAN al iniciar (snapshot). */
export interface Parada {
  estudianteId: string;
  estudiante: string;
  grado: string;
  direccion: string;
  acudiente: string;
  telefonoAcudiente: string;
  estado: EstadoParada;
  /** ISO de cuando subió al vehículo. */
  horaAbordo: string | null;
  /** ISO de cuando se entregó (colegio en recogida, casa en entrega). */
  horaEntrega: string | null;
  /** Solo si `estado` es AUSENTE. */
  motivoAusencia: MotivoAusencia | '';
  /** El acudiente avisó desde su portal que no viaja (lo confirma quien lo marca AUSENTE). */
  aviso?: AvisoParada | null;
  /** Colegio del estudiante al iniciar (la ruta puede atender varios). `''`/ausente en recorridos anteriores. */
  colegioId?: string;
  colegio?: string;
  direccionColegio?: string;
}

/** Un colegio del recorrido. `colegioId` `''` en recorridos anteriores (un solo colegio). */
export interface ColegioRecorrido {
  colegioId: string;
  nombre: string;
  direccion: string;
}

export type EstadoRecorrido = 'EN_CURSO' | 'FINALIZADO';

export interface Recorrido extends Entidad {
  asignacionId: string;
  rutaId: string;
  /** `YYYY-MM-DD` */
  fecha: string;
  trayecto: Trayecto;
  estado: EstadoRecorrido;
  // Snapshot de la asignación al iniciar
  ruta: string;
  jornada: string;
  colegio: string;
  direccionColegio: string;
  vehiculo: string;
  conductorId: string;
  conductor: string;
  monitoraId: string;
  monitora: string;
  /** En el orden en que se visitan. */
  paradas: Parada[];
  /** ISO */
  inicio: string;
  fin: string | null;
  /** Empleado que inició el recorrido. */
  iniciadoPor: string;
  /** Último cambio del orden de visita (lo hace la monitora durante el recorrido). */
  ordenActualizado?: CambioOrden | null;
  observaciones: string;
  /** Colegios en el orden en que aparecen sus estudiantes (`colegio` = sus nombres unidos). */
  colegios?: ColegioRecorrido[];
}

export interface CambioOrden {
  /** `''` si lo cambió el administrador desde la ruta. */
  empleadoId: string;
  nombre: string;
  /** ISO */
  hora: string;
}

export interface ConteoParadas {
  total: number;
  pendientes: number;
  aBordo: number;
  entregados: number;
  ausentes: number;
}

export interface ResumenRecorrido {
  id: string;
  trayecto: Trayecto;
  estado: EstadoRecorrido;
  inicio: string;
  fin: string | null;
  conteo: ConteoParadas;
}

/** Ruta que el empleado autenticado cubre hoy (asignación activa vigente en la fecha). */
export interface RutaAsignada {
  asignacionId: string;
  rutaId: string;
  ruta: string;
  jornada: string;
  sector: string;
  colegio: string;
  direccionColegio: string;
  vehiculo: string;
  /** Rol del empleado en esta ruta. */
  rol: 'CONDUCTOR' | 'MONITORA';
  /** La otra persona del vehículo (monitora del conductor o viceversa). */
  companero: { nombre: string; telefono: string; rol: 'CONDUCTOR' | 'MONITORA'; /** Foto de perfil (`''` = iniciales). */ foto?: string } | null;
  estudiantes: number;
  /** Estudiantes de la ruta con aviso de ausencia del acudiente en la fecha. */
  avisosAusencia?: number;
  /** Recorridos de la fecha consultada. */
  recorridos: ResumenRecorrido[];
  /** Horario del turno (`06:00–09:30`); `''` = toda la jornada. */
  horario?: string;
  /** Colegios de la ruta (si son varios, `colegio` los une y `direccionColegio` va vacío). */
  colegios?: ColegioRecorrido[];
}

export function contarParadas(paradas: Parada[]): ConteoParadas {
  const de = (estado: EstadoParada) => paradas.filter((p) => p.estado === estado).length;
  return {
    total: paradas.length,
    pendientes: de('PENDIENTE'),
    aBordo: de('A_BORDO'),
    entregados: de('ENTREGADO'),
    ausentes: de('AUSENTE'),
  };
}

export function resumirRecorrido(r: Recorrido): ResumenRecorrido {
  return { id: r.id, trayecto: r.trayecto, estado: r.estado, inicio: r.inicio, fin: r.fin, conteo: contarParadas(r.paradas) };
}

/** Porcentaje de estudiantes con su situación resuelta (entregado o ausente). */
export function avance(conteo: ConteoParadas): number {
  return conteo.total ? Math.round(((conteo.entregados + conteo.ausentes) / conteo.total) * 100) : 100;
}

/** Orden de visita: la entrega recorre la ruta al revés que la recogida. */
export function ordenarParadas<T>(estudiantesEnOrdenDeRuta: T[], trayecto: Trayecto): T[] {
  return trayecto === 'RECOGIDA' ? [...estudiantesEnOrdenDeRuta] : [...estudiantesEnOrdenDeRuta].reverse();
}

/** Estudiantes de un colegio del recorrido, en el orden de visita. */
export interface GrupoColegio {
  colegio: ColegioRecorrido;
  paradas: Parada[];
  pendientes: Parada[];
  aBordo: Parada[];
}

type DatosColegios = Pick<Recorrido, 'trayecto' | 'paradas'> & Partial<Pick<Recorrido, 'colegio' | 'direccionColegio' | 'colegios'>>;

/** Colegios del recorrido (los anteriores a varios colegios tienen uno solo, sin id). */
export function colegiosDelRecorrido(r: DatosColegios): ColegioRecorrido[] {
  if (r.colegios?.length) return r.colegios;
  return [{ colegioId: '', nombre: r.colegio ?? '', direccion: r.direccionColegio ?? '' }];
}

/** Estudiantes agrupados por colegio, en el orden de los colegios. */
export function gruposPorColegio(r: DatosColegios): GrupoColegio[] {
  const colegios = colegiosDelRecorrido(r);
  const ids = new Set(colegios.map((c) => c.colegioId));
  return colegios.map((colegio, i) => {
    // Un estudiante sin colegio conocido va con el primero.
    const paradas = r.paradas.filter((p) => (p.colegioId ?? '') === colegio.colegioId || (i === 0 && !ids.has(p.colegioId ?? '')));
    return {
      colegio,
      paradas,
      pendientes: paradas.filter((p) => p.estado === 'PENDIENTE'),
      aBordo: paradas.filter((p) => p.estado === 'A_BORDO'),
    };
  });
}

/**
 * RECOGIDA con varios colegios: colegios cuyos estudiantes ya se recogieron todos (ninguno pendiente) y que tienen
 * alguno a bordo: "Llegada al colegio X" se puede hacer mientras sigue la recogida de los otros.
 */
export function llegadasListas(r: DatosColegios): GrupoColegio[] {
  if (r.trayecto !== 'RECOGIDA') return [];
  return gruposPorColegio(r).filter((g) => g.aBordo.length > 0 && g.pendientes.length === 0);
}

/** ENTREGA: el colegio ya inició su salida (alguien subió o ya se entregó). */
function salidaIniciada(g: GrupoColegio): boolean {
  return g.paradas.some((p) => p.estado === 'A_BORDO' || p.estado === 'ENTREGADO');
}

/**
 * ENTREGA con varios colegios: los que aún no inician la salida (siguen pendientes hasta que se marquen). Al iniciar
 * uno, sus estudiantes se unen a los que faltan por entregar, en el orden inverso al programado.
 */
export function colegiosPorRecoger(r: DatosColegios): GrupoColegio[] {
  if (r.trayecto !== 'ENTREGA') return [];
  return gruposPorColegio(r).filter((g) => g.pendientes.length > 0 && !salidaIniciada(g));
}

/**
 * Qué toca hacer ahora:
 * - RECOGIDA: recoger al siguiente PENDIENTE; sin pendientes y con alguien a bordo → llegar al colegio (uno por
 *   colegio si son varios; con varios, un colegio ya completo se entrega antes desde `llegadasListas`).
 * - ENTREGA con un colegio: primero el abordaje en el colegio (PENDIENTE); luego entregar al siguiente A_BORDO.
 * - ENTREGA con varios: abordaje de los colegios ya iniciados; luego entregar a bordo; luego iniciar la salida de
 *   otro colegio (`SALIDA_COLEGIOS`, un botón por colegio o todos).
 * - Todos resueltos → finalizar.
 */
export type PasoRecorrido =
  | { tipo: 'RECOGER'; parada: Parada }
  | { tipo: 'LLEGADA_COLEGIO'; aBordo: number; grupos: GrupoColegio[] }
  | { tipo: 'ABORDAJE'; pendientes: Parada[]; grupos: GrupoColegio[] }
  | { tipo: 'SALIDA_COLEGIOS'; grupos: GrupoColegio[] }
  | { tipo: 'ENTREGAR'; parada: Parada }
  | { tipo: 'FINALIZAR' };

export function siguientePaso(r: DatosColegios): PasoRecorrido {
  const pendientes = r.paradas.filter((p) => p.estado === 'PENDIENTE');
  const aBordo = r.paradas.filter((p) => p.estado === 'A_BORDO');
  const grupos = gruposPorColegio(r);
  if (r.trayecto === 'RECOGIDA') {
    if (pendientes.length) return { tipo: 'RECOGER', parada: pendientes[0] };
    if (aBordo.length) return { tipo: 'LLEGADA_COLEGIO', aBordo: aBordo.length, grupos: grupos.filter((g) => g.aBordo.length) };
  } else if (grupos.length <= 1) {
    if (pendientes.length) return { tipo: 'ABORDAJE', pendientes, grupos };
    if (aBordo.length) return { tipo: 'ENTREGAR', parada: aBordo[0] };
  } else {
    const iniciados = grupos.filter((g) => salidaIniciada(g) && g.pendientes.length);
    if (iniciados.length) return { tipo: 'ABORDAJE', pendientes: iniciados.flatMap((g) => g.pendientes), grupos: iniciados };
    if (aBordo.length) return { tipo: 'ENTREGAR', parada: aBordo[0] };
    const porRecoger = colegiosPorRecoger(r);
    if (porRecoger.length) return { tipo: 'SALIDA_COLEGIOS', grupos: porRecoger };
  }
  return { tipo: 'FINALIZAR' };
}

/**
 * El administrador cambió el orden de recogida de la ruta (`orden` = sus estudiantes en el nuevo orden): lo que falta
 * por visitar se reordena (al revés en la entrega); lo visitado queda igual. `null` si no cambia nada. Igual que
 * `ServicioRecorridos.AplicarOrdenDeRutaAsync`.
 */
export function reordenarSegunRuta(r: Pick<Recorrido, 'trayecto' | 'paradas'>, orden: string[]): Parada[] | null {
  const posicion = new Map(orden.map((id, i) => [id, i]));
  const { visitadas, pendientes } = paradasEnOrden(r);
  const clave = (p: Parada) => {
    const i = posicion.get(p.estudianteId);
    return i === undefined ? Number.MAX_SAFE_INTEGER : r.trayecto === 'ENTREGA' ? orden.length - i : i;
  };
  const nuevos = pendientes.map((p, i) => ({ p, i })).sort((a, b) => clave(a.p) - clave(b.p) || a.i - b.i).map((x) => x.p);
  return nuevos.every((p, i) => p === pendientes[i]) ? null : [...visitadas, ...nuevos];
}

/**
 * ¿Falta visitar esta parada? Solo esas se pueden reordenar:
 * - RECOGIDA: las PENDIENTES (las que van a bordo ya se recogieron).
 * - ENTREGA: las PENDIENTES y las A BORDO (aún no se entregan en su casa).
 */
export function porVisitar(p: Parada, trayecto: Trayecto): boolean {
  return p.estado === 'PENDIENTE' || (trayecto === 'ENTREGA' && p.estado === 'A_BORDO');
}

/** Orden en pantalla: primero las ya visitadas (en su orden) y luego las que faltan, en el orden de visita. */
export function paradasEnOrden(r: Pick<Recorrido, 'trayecto' | 'paradas'>): { visitadas: Parada[]; pendientes: Parada[] } {
  return {
    visitadas: r.paradas.filter((p) => !porVisitar(p, r.trayecto)),
    pendientes: r.paradas.filter((p) => porVisitar(p, r.trayecto)),
  };
}

/** Mueve un elemento de `desde` a `hasta`; los que están entre ambos se corren una posición. */
export function moverEnLista<T>(lista: T[], desde: number, hasta: number): T[] {
  const copia = [...lista];
  const [elemento] = copia.splice(desde, 1);
  copia.splice(Math.max(0, Math.min(hasta, copia.length)), 0, elemento);
  return copia;
}

/**
 * Nuevo orden de visita: `ordenIds` son EXACTAMENTE las paradas por visitar en el orden deseado.
 * Lanza `Error` si no coinciden (p. ej. el conductor marcó a alguien mientras la monitora arrastraba).
 */
export function reordenarParadas(r: Pick<Recorrido, 'trayecto' | 'paradas'>, ordenIds: string[]): Parada[] {
  const { visitadas, pendientes } = paradasEnOrden(r);
  const porId = new Map(pendientes.map((p) => [p.estudianteId, p]));
  if (ordenIds.length !== pendientes.length || new Set(ordenIds).size !== ordenIds.length || ordenIds.some((id) => !porId.has(id))) {
    throw new Error('El recorrido cambió mientras ordenabas. Revisa la lista e inténtalo de nuevo.');
  }
  return [...visitadas, ...ordenIds.map((id) => porId.get(id) as Parada)];
}

/**
 * Quién comparte la ubicación del vehículo: el conductor Y la monitora del recorrido mientras está EN CURSO,
 * para que siga al día aunque uno de los dos cierre la app o apague el teléfono (el servidor descarta las
 * lecturas casi simultáneas de los dos).
 */
export function reportaUbicacion(r: Pick<Recorrido, 'estado' | 'conductorId' | 'monitoraId'>, empleadoId: string | null | undefined): boolean {
  return r.estado === 'EN_CURSO' && !!empleadoId && (empleadoId === r.conductorId || empleadoId === r.monitoraId);
}

/**
 * Quién puede cambiar el orden de visita: la monitora de la asignación (el conductor va manejando).
 * Si la asignación no tiene monitora, el conductor.
 */
export function puedeReordenar(r: Pick<Recorrido, 'estado' | 'conductorId' | 'monitoraId'>, empleadoId: string | null | undefined): boolean {
  if (r.estado !== 'EN_CURSO' || !empleadoId) return false;
  return r.monitoraId ? empleadoId === r.monitoraId : empleadoId === r.conductorId;
}

/** Un recorrido solo se finaliza con TODOS entregados o ausentes: nadie puede quedar a bordo. */
export function motivoNoFinalizar(paradas: Parada[]): string | null {
  const { aBordo, pendientes } = contarParadas(paradas);
  if (aBordo) {
    return `${aBordo === 1 ? 'Hay 1 estudiante' : `Hay ${aBordo} estudiantes`} a bordo. Ningún estudiante puede quedar en el vehículo: márcalo como entregado.`;
  }
  if (pendientes) {
    return `${pendientes === 1 ? 'Falta 1 estudiante' : `Faltan ${pendientes} estudiantes`} por marcar como recogido o "No asistió".`;
  }
  return null;
}

/**
 * Aplica un cambio de estado con su hora (y el motivo si queda AUSENTE). Lanza `Error` si la transición no
 * está permitida. Marcar AUSENTE a quien ya lo está solo corrige el motivo.
 */
export function cambiarEstado(parada: Parada, estado: EstadoParada, ahora: string, motivo: MotivoAusencia | '' = ''): Parada {
  const motivoAusencia = estado === 'AUSENTE' ? motivo : '';
  if (parada.estado === estado) return parada.motivoAusencia === motivoAusencia ? parada : { ...parada, motivoAusencia };
  if (!transicionPermitida(parada.estado, estado)) {
    throw new Error(`${parada.estudiante}: no se puede pasar de "${ESTADOS_PARADA[parada.estado].nombre}" a "${ESTADOS_PARADA[estado].nombre}".`);
  }
  switch (estado) {
    case 'A_BORDO':
      return { ...parada, estado, horaAbordo: parada.estado === 'ENTREGADO' ? parada.horaAbordo : ahora, horaEntrega: null, motivoAusencia };
    case 'ENTREGADO':
      return { ...parada, estado, horaEntrega: ahora, motivoAusencia };
    default:
      return { ...parada, estado, horaAbordo: null, horaEntrega: null, motivoAusencia };
  }
}

/** Enlace de navegación (Google Maps) a una dirección de la ciudad. */
export function enlaceMapa(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

/** Enlace `wa.me` con mensaje (Colombia +57 si el número no trae indicativo). */
export function enlaceWhatsapp(telefono: string, mensaje: string): string {
  const digitos = telefono.replace(/\D/g, '');
  const numero = digitos.length === 10 ? `57${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
