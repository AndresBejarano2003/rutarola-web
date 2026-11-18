import { Observable } from 'rxjs';
import { IngresosPlataforma } from './ingresos';

/** Ingresos de la plataforma por planes pagados (Plataforma › Ingresos, SUPER_ADMIN). */
export abstract class IngresosRepositorio {
  /** `desde`/`hasta` `YYYY-MM-DD`, ambos incluidos (máximo 3 años). */
  abstract obtener(desde: string, hasta: string): Observable<IngresosPlataforma>;
}
