import { Observable } from 'rxjs';
import { AvisoAusencia } from 'src/app/ruta-del-dia/avisos-ausencia';

export interface FiltrosAvisoAusencia {
  /** `YYYY-MM-DD`; vacío = hoy. */
  fecha: string;
  rutaId: string;
}

/**
 * Avisos de ausencia de los acudientes, vistos por el administrador (Operación › Asignaciones).
 * Implementaciones: `AvisosAusenciaLocal` → `AvisosAusenciaHttp`.
 */
export abstract class AvisosAusenciaRepositorio {
  abstract listar(filtros: FiltrosAvisoAusencia): Observable<AvisoAusencia[]>;
}
