import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { IngresosPlataforma } from './ingresos';
import { IngresosRepositorio } from './ingresos-repositorio';

/**
 * `GET /plataforma/ingresos?desde=&hasta=` (`empresas.gestionar`, SUPER_ADMIN) → `IngresosPlataforma`: pagos de planes
 * APROBADOS (Wompi y los que la plataforma registra al activar un plan, método MANUAL) por la fecha en que se aplicaron;
 * 422 si `hasta` < `desde` o el rango supera 3 años. Vacíos = mes actual.
 */
@Injectable()
export class IngresosHttp extends IngresosRepositorio {
  private readonly http = inject(HttpClient);

  obtener(desde: string, hasta: string): Observable<IngresosPlataforma> {
    return this.http.get<IngresosPlataforma>(`${environment.apiUrl}/plataforma/ingresos`, { params: new HttpParams().set('desde', desde).set('hasta', hasta) });
  }
}
