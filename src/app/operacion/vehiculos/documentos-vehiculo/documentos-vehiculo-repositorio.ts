import { Observable } from 'rxjs';
import { DocumentoVehiculo, SolicitudDocumentoVehiculo } from './documento-vehiculo';

/**
 * Historial de documentos de un vehículo. Al guardar o borrar, el vencimiento del vehículo para ese tipo pasa a ser
 * el del registro más reciente. Implementaciones: `DocumentosVehiculoLocal` → `DocumentosVehiculoHttp`.
 */
export abstract class DocumentosVehiculoRepositorio {
  /** Más reciente primero (por vencimiento). */
  abstract listar(vehiculoId: string): Observable<DocumentoVehiculo[]>;
  /** Con el contenido del archivo. */
  abstract obtener(vehiculoId: string, id: string): Observable<DocumentoVehiculo>;
  abstract crear(vehiculoId: string, solicitud: SolicitudDocumentoVehiculo): Observable<DocumentoVehiculo>;
  abstract actualizar(vehiculoId: string, id: string, solicitud: SolicitudDocumentoVehiculo): Observable<DocumentoVehiculo>;
  abstract eliminar(vehiculoId: string, id: string): Observable<void>;
}
