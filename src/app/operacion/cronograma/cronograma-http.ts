import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { Cronograma, DetalleDiaCronograma } from './cronograma';
import { CronogramaRepositorio } from './cronograma-repositorio';

/**
 * - `GET /cronograma?desde=&hasta=` (`rutas.leer`, plan con `CRONOGRAMA`) → `Cronograma`; 422 sin fechas, `hasta` < `desde`
 *   o más de 400 días.
 * - `GET /cronograma/dia?fecha=` → `DetalleDiaCronograma` (sin fecha = hoy).
 * Sin la función en el plan responde 403 "Tu plan X no incluye el cronograma de la operación…".
 */
@Injectable()
export class CronogramaHttp extends CronogramaRepositorio {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/cronograma`;

  obtener(desde: string, hasta: string): Observable<Cronograma> {
    return this.http.get<Cronograma>(this.url, { params: new HttpParams().set('desde', desde).set('hasta', hasta) });
  }

  dia(fecha: string): Observable<DetalleDiaCronograma> {
    return this.http.get<DetalleDiaCronograma>(`${this.url}/dia`, { params: new HttpParams().set('fecha', fecha) });
  }
}
