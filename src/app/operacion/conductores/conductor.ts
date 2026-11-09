import { EstadoRegistro } from 'src/app/shared/crud/crud';
import { EstadoVencimiento } from 'src/app/shared/vencimiento/vencimiento';

/**
 * Vista OPERATIVA de un conductor: sus datos viven en Personas › Empleados;
 * aquí se agregan la licencia y la asignación activa (ruta y vehículo).
 */
export interface ConductorOperacion {
  /** Id del empleado. */
  id: string;
  nombre: string;
  iniciales: string;
  /** Foto de perfil del empleado (`''` = iniciales). */
  foto: string;
  documento: string;
  telefono: string;
  correo: string;
  numeroLicencia: string;
  categoriaLicencia: string;
  vencimientoLicencia: string;
  estadoLicencia: EstadoVencimiento | null;
  estado: EstadoRegistro;
  asignacion: {
    id: string;
    ruta: string;
    jornada: string;
    vehiculo: string;
    monitora: string;
  } | null;
}

export interface FiltrosConductor {
  texto: string;
  licencia: EstadoVencimiento | '';
  /** `CON` = con ruta asignada, `SIN` = disponible. */
  asignacion: 'CON' | 'SIN' | '';
  estado: EstadoRegistro | '';
}

export const FILTROS_CONDUCTOR_VACIOS: FiltrosConductor = { texto: '', licencia: '', asignacion: '', estado: '' };

export const ESTADOS_LICENCIA: { id: EstadoVencimiento; nombre: string }[] = [
  { id: 'VIGENTE', nombre: 'Licencia vigente' },
  { id: 'POR_VENCER', nombre: 'Licencia por vencer' },
  { id: 'VENCIDA', nombre: 'Licencia vencida' },
];

export const OPCIONES_ASIGNACION = [
  { id: 'CON', nombre: 'Con ruta asignada' },
  { id: 'SIN', nombre: 'Disponibles (sin ruta)' },
];
