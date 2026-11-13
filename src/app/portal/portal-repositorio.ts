import { Observable } from 'rxjs';
import { AvisoAusencia, SolicitudAvisoAusencia } from 'src/app/ruta-del-dia/avisos-ausencia';
import { PortalAcudiente } from './portal';

/**
 * Datos del acudiente AUTENTICADO (sale de la sesión/token, nunca de un parámetro): sus estudiantes
 * con colegio, ruta y recorrido de hoy; su estado de cuenta; recibos y cotizaciones.
 * Implementaciones: `PortalLocal` (temporal) → `PortalHttp`.
 */
export abstract class PortalRepositorio {
  abstract obtener(): Observable<PortalAcudiente>;
  /** Avisa cuando conviene recargar: cambió un recorrido de sus estudiantes (inició, una marca o terminó). */
  abstract observarCambios(): Observable<unknown>;
  /**
   * Avisa que su estudiante no viaja una fecha (hoy a 30 días). 404 si no es su estudiante; 409 ya hay aviso ese día;
   * 422 fecha fuera de rango o el recorrido ya terminó.
   */
  abstract crearAviso(solicitud: SolicitudAvisoAusencia): Observable<AvisoAusencia>;
  /** Retira el aviso (422 si la ruta ya lo confirmó o es de un día pasado). */
  abstract cancelarAviso(id: string): Observable<void>;
}
