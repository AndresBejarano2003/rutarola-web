import { ArchivoAdjunto } from 'src/app/shared/archivo-adjunto/archivo-adjunto';
import { TipoDocumentoVehiculo } from '../vehiculo';

/**
 * Registro del historial de documentos del vehículo (SOAT, técnico-mecánica, tarjeta de operación, pólizas u otro)
 * con su PDF o imagen. `vigente` = el de vencimiento más reciente de su tipo (OTRO nunca lo es). Igual a
 * `DocumentoHistorialDto` del API.
 */
export interface DocumentoVehiculo {
  id: string;
  vehiculoId: string;
  tipo: TipoDocumentoVehiculo;
  numero: string;
  /** Aseguradora, CDA, Secretaría de Movilidad… */
  entidad: string;
  /** `YYYY-MM-DD` o `''`. */
  fechaExpedicion: string;
  /** `YYYY-MM-DD` */
  fechaVencimiento: string;
  observaciones: string;
  /** En la lista llega con `url: ''`; el detalle trae el archivo. */
  archivo: ArchivoAdjunto | null;
  vigente: boolean;
  fechaCreacion: string;
}

/** `POST/PUT /vehiculos/{id}/documentos[/{docId}]`. `archivo`: data URL = nuevo, otra url = se conserva, null = se quita. */
export type SolicitudDocumentoVehiculo = Pick<
  DocumentoVehiculo,
  'tipo' | 'numero' | 'entidad' | 'fechaExpedicion' | 'fechaVencimiento' | 'observaciones' | 'archivo'
>;
