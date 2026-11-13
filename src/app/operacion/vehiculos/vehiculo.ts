import { Entidad, EstadoRegistro } from 'src/app/shared/crud/crud';
import { peorVencimiento } from 'src/app/shared/vencimiento/vencimiento';

export type TipoVehiculo = 'BUS' | 'BUSETA' | 'MICROBUS' | 'CAMIONETA';

export interface Vehiculo extends Entidad {
  /** `ABC123` (mayúsculas, sin espacios). */
  placa: string;
  numeroInterno: string;
  tipo: TipoVehiculo;
  marca: string;
  linea: string;
  /** Año del modelo. */
  modelo: number;
  color: string;
  /** Puestos para estudiantes (sin contar conductor ni monitora). */
  capacidad: number;
  /** Fechas de vencimiento `YYYY-MM-DD`. */
  vencimientoSoat: string;
  vencimientoTecnomecanica: string;
  vencimientoTarjetaOperacion: string;
  vencimientoPolizas: string;
  estado: EstadoRegistro;
  observaciones: string;
  /** Foto del vehículo (data URL JPEG cuadrada de 256 px, `''` = sin foto). */
  foto?: string;
}

export interface FiltrosVehiculo {
  /** Busca en placa, número interno, marca y línea. */
  texto: string;
  tipo: TipoVehiculo | '';
  estado: EstadoRegistro | '';
}

export const FILTROS_VEHICULO_VACIOS: FiltrosVehiculo = { texto: '', tipo: '', estado: '' };

export const TIPOS_VEHICULO: { id: TipoVehiculo; nombre: string }[] = [
  { id: 'BUS', nombre: 'Bus' },
  { id: 'BUSETA', nombre: 'Buseta' },
  { id: 'MICROBUS', nombre: 'Microbús' },
  { id: 'CAMIONETA', nombre: 'Camioneta' },
];

/** Documentos obligatorios del vehículo (campo → nombre). */
export const DOCUMENTOS_VEHICULO = [
  { campo: 'vencimientoSoat', nombre: 'SOAT' },
  { campo: 'vencimientoTecnomecanica', nombre: 'Revisión técnico-mecánica' },
  { campo: 'vencimientoTarjetaOperacion', nombre: 'Tarjeta de operación' },
  { campo: 'vencimientoPolizas', nombre: 'Pólizas RCC / RCE' },
] as const;

export type TipoDocumentoVehiculo = 'SOAT' | 'TECNOMECANICA' | 'TARJETA_OPERACION' | 'POLIZAS' | 'OTRO';

/** Tipos del historial; cada uno (menos OTRO) mantiene el vencimiento del vehículo con su registro más reciente. */
export const TIPOS_DOCUMENTO_VEHICULO: { id: TipoDocumentoVehiculo; nombre: string; campo: (typeof DOCUMENTOS_VEHICULO)[number]['campo'] | null }[] = [
  { id: 'SOAT', nombre: 'SOAT', campo: 'vencimientoSoat' },
  { id: 'TECNOMECANICA', nombre: 'Revisión técnico-mecánica', campo: 'vencimientoTecnomecanica' },
  { id: 'TARJETA_OPERACION', nombre: 'Tarjeta de operación', campo: 'vencimientoTarjetaOperacion' },
  { id: 'POLIZAS', nombre: 'Pólizas RCC / RCE', campo: 'vencimientoPolizas' },
  { id: 'OTRO', nombre: 'Otro documento', campo: null },
];

export function nombreTipoDocumento(tipo: TipoDocumentoVehiculo): string {
  return TIPOS_DOCUMENTO_VEHICULO.find((t) => t.id === tipo)?.nombre ?? tipo;
}

export function estadoDocumentos(v: Vehiculo) {
  return peorVencimiento(DOCUMENTOS_VEHICULO.map((d) => v[d.campo]));
}

/** Documentos vencidos, p. ej. para impedir asignar el vehículo a una ruta. */
export function documentosVencidos(v: Vehiculo, hoy = new Date().toISOString().slice(0, 10)): string[] {
  return DOCUMENTOS_VEHICULO.filter((d) => v[d.campo] && v[d.campo] < hoy).map((d) => d.nombre);
}

export function etiquetaVehiculo(v: Pick<Vehiculo, 'placa' | 'numeroInterno' | 'marca'>): string {
  return `${v.placa} · Interno ${v.numeroInterno} · ${v.marca}`;
}
