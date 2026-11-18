import { Observable } from 'rxjs';
import { Cronograma, DetalleDiaCronograma } from './cronograma';

/** Cronograma de la operación (Operación › Cronograma, planes con CRONOGRAMA). */
export abstract class CronogramaRepositorio {
  /** Resumen por día; `desde`/`hasta` `YYYY-MM-DD` incluidos, máximo 400 días. */
  abstract obtener(desde: string, hasta: string): Observable<Cronograma>;
  /** Rutas con sus trayectos, avisos de ausencia y agenda de un día. */
  abstract dia(fecha: string): Observable<DetalleDiaCronograma>;
}
