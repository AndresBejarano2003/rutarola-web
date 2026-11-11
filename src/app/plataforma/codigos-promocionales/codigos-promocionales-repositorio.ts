import { Observable } from 'rxjs';
import { RepositorioCrud } from 'src/app/shared/crud/repositorio-crud';
import { CodigoPromocional, FiltrosCodigoPromocional, UsoCodigo } from './codigo-promocional';

/**
 * Códigos promocionales de la plataforma (solo SUPER_ADMIN). Un código con usos no se elimina: se deja Inactivo.
 * Implementaciones: `CodigosPromocionalesLocal` → `CodigosPromocionalesHttp`.
 */
export abstract class CodigosPromocionalesRepositorio extends RepositorioCrud<CodigoPromocional, FiltrosCodigoPromocional> {
  /** Empresas que lo usaron (más recientes primero). */
  abstract usos(id: string): Observable<UsoCodigo[]>;
}
