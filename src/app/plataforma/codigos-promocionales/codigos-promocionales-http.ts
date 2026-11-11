import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RepositorioHttp } from 'src/app/shared/crud/repositorio-http';
import { CodigoPromocional, FiltrosCodigoPromocional, UsoCodigo } from './codigo-promocional';
import { CodigosPromocionalesRepositorio } from './codigos-promocionales-repositorio';

/**
 * `promociones.gestionar` (SUPER_ADMIN): `{apiUrl}/plataforma/codigos-promocionales` (filtros `texto`, `estado`,
 * `vigencia` PROGRAMADO|VIGENTE|VENCIDO), CRUD estándar + `GET /{id}/usos` → `UsoCodigo[]`.
 * Reglas del API: código único sin importar mayúsculas (409); 400 si el porcentaje no está entre 1 y 100, el valor fijo
 * entre $1.000 y $10.000.000, la fecha final es anterior a la inicial o el alcance EMPRESAS no trae empresas;
 * `DELETE` 409 si ya se usó o hay pagos iniciados con él (se inactiva).
 * La empresa lo valida en `POST /suscripcion/codigo` (ver `suscripcion-http.ts`).
 */
@Injectable()
export class CodigosPromocionalesHttp
  extends RepositorioHttp<CodigoPromocional, FiltrosCodigoPromocional>
  implements CodigosPromocionalesRepositorio
{
  protected readonly recurso = 'plataforma/codigos-promocionales';

  usos(id: string): Observable<UsoCodigo[]> {
    return this.http.get<UsoCodigo[]>(`${this.url}/${encodeURIComponent(id)}/usos`);
  }
}
