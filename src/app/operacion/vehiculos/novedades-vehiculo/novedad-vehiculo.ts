import { ArchivoAdjunto } from 'src/app/shared/archivo-adjunto/archivo-adjunto';

/** Lo que reporta el conductor o la monitora sobre el vehículo (`TipoNovedadVehiculo` del API). */
export type TipoNovedadVehiculo = 'AVERIA' | 'DANO' | 'LLANTAS' | 'MANTENIMIENTO' | 'LIMPIEZA' | 'DOCUMENTOS' | 'OTRO';
/** ALTA = afecta la operación o la seguridad (el vehículo no debería salir). */
export type GravedadNovedad = 'BAJA' | 'MEDIA' | 'ALTA';
/** PENDIENTE (recién reportada) → EN_PROCESO (en taller o revisión) → RESUELTA (con la respuesta). */
export type EstadoNovedadVehiculo = 'PENDIENTE' | 'EN_PROCESO' | 'RESUELTA';

export const TIPOS_NOVEDAD: readonly { id: TipoNovedadVehiculo; nombre: string; icono: string }[] = [
  { id: 'AVERIA', nombre: 'Avería mecánica', icono: 'fa-car-burst' },
  { id: 'DANO', nombre: 'Daño (carrocería, vidrios, sillas…)', icono: 'fa-hammer' },
  { id: 'LLANTAS', nombre: 'Llantas', icono: 'fa-circle-dot' },
  { id: 'MANTENIMIENTO', nombre: 'Mantenimiento pendiente', icono: 'fa-screwdriver-wrench' },
  { id: 'LIMPIEZA', nombre: 'Aseo', icono: 'fa-soap' },
  { id: 'DOCUMENTOS', nombre: 'Documentos del vehículo', icono: 'fa-file-lines' },
  { id: 'OTRO', nombre: 'Otra novedad', icono: 'fa-circle-exclamation' },
];

export const GRAVEDADES_NOVEDAD: readonly { id: GravedadNovedad; nombre: string; descripcion: string; clase: string }[] = [
  { id: 'BAJA', nombre: 'Baja', descripcion: 'Se puede atender después', clase: 'badge-info' },
  { id: 'MEDIA', nombre: 'Media', descripcion: 'Hay que revisarla pronto', clase: 'badge-warning' },
  { id: 'ALTA', nombre: 'Alta', descripcion: 'Afecta la seguridad o la operación', clase: 'badge-error' },
];

export const ESTADOS_NOVEDAD: readonly { id: EstadoNovedadVehiculo; nombre: string; clase: string }[] = [
  { id: 'PENDIENTE', nombre: 'Pendiente', clase: 'badge-warning' },
  { id: 'EN_PROCESO', nombre: 'En proceso', clase: 'badge-info' },
  { id: 'RESUELTA', nombre: 'Resuelta', clase: 'badge-success' },
];

export const nombreTipoNovedad = (t: TipoNovedadVehiculo) => TIPOS_NOVEDAD.find((x) => x.id === t)?.nombre ?? t;
export const iconoTipoNovedad = (t: TipoNovedadVehiculo) => TIPOS_NOVEDAD.find((x) => x.id === t)?.icono ?? 'fa-circle-exclamation';
export const gravedad = (g: GravedadNovedad) => GRAVEDADES_NOVEDAD.find((x) => x.id === g) ?? GRAVEDADES_NOVEDAD[1];
export const estadoNovedad = (e: EstadoNovedadVehiculo) => ESTADOS_NOVEDAD.find((x) => x.id === e) ?? ESTADOS_NOVEDAD[0];

/**
 * Novedad del vehículo (igual a `NovedadVehiculoDto`). `reporta` = snapshot del nombre de quien la reportó;
 * `reportadaPorMi` = la reportó el empleado de la sesión. En las listas el archivo llega con `url: ''`.
 */
export interface NovedadVehiculo {
  id: string;
  vehiculoId: string;
  /** Placa · interno. */
  vehiculo: string;
  tipo: TipoNovedadVehiculo;
  gravedad: GravedadNovedad;
  descripcion: string;
  kilometraje: number | null;
  estado: EstadoNovedadVehiculo;
  reporta: string;
  reportadaPorMi: boolean;
  /** La reportó un conductor o una monitora (no el administrador). */
  delPersonal: boolean;
  /** Qué se hizo (obligatoria al resolver). */
  respuesta: string;
  atiende: string;
  fechaAtencion: string | null;
  archivo: ArchivoAdjunto | null;
  fechaCreacion: string;
}

export interface SolicitudNovedad {
  vehiculoId: string;
  tipo: TipoNovedadVehiculo;
  gravedad: GravedadNovedad;
  descripcion: string;
  kilometraje: number | null;
  archivo: ArchivoAdjunto | null;
}

export interface SolicitudEstadoNovedad {
  estado: EstadoNovedadVehiculo;
  respuesta: string;
}

export interface FiltrosNovedad {
  vehiculoId?: string;
  estado?: EstadoNovedadVehiculo | '';
  /** Solo PENDIENTE y EN_PROCESO. */
  abiertas?: boolean;
}

/** Abiertas primero (las graves arriba) y luego las más recientes (igual que el API). */
export function ordenarNovedades(a: NovedadVehiculo, b: NovedadVehiculo): number {
  const abierta = (n: NovedadVehiculo) => (n.estado === 'RESUELTA' ? 1 : 0);
  const peso = { BAJA: 0, MEDIA: 1, ALTA: 2 } as const;
  return abierta(a) - abierta(b) || peso[b.gravedad] - peso[a.gravedad] || b.fechaCreacion.localeCompare(a.fechaCreacion);
}
