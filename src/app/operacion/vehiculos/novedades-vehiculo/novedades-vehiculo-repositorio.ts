import { Observable } from 'rxjs';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { FiltrosNovedad, NovedadVehiculo, SolicitudEstadoNovedad, SolicitudNovedad } from './novedad-vehiculo';

/**
 * Novedades del vehículo (averías, daños…). El administrador lista, registra y atiende; el conductor y la monitora
 * reportan desde la Ruta del día sobre los vehículos de sus asignaciones (el empleado sale de la sesión/token).
 * Implementaciones: `NovedadesVehiculoLocal` → `NovedadesVehiculoHttp`.
 */
export abstract class NovedadesVehiculoRepositorio {
  // Administrador
  abstract listar(filtros: FiltrosNovedad): Observable<NovedadVehiculo[]>;
  /** Con el contenido del archivo. */
  abstract obtener(id: string): Observable<NovedadVehiculo>;
  abstract registrar(solicitud: SolicitudNovedad): Observable<NovedadVehiculo>;
  abstract cambiarEstado(id: string, solicitud: SolicitudEstadoNovedad): Observable<NovedadVehiculo>;
  // Conductor / monitora
  /** Vehículos de sus asignaciones activas que no han terminado. */
  abstract misVehiculos(): Observable<OpcionCatalogo[]>;
  abstract mias(): Observable<NovedadVehiculo[]>;
  abstract obtenerMia(id: string): Observable<NovedadVehiculo>;
  abstract reportar(solicitud: SolicitudNovedad): Observable<NovedadVehiculo>;
}
