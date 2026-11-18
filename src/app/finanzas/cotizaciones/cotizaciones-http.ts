import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RepositorioHttp } from 'src/app/shared/crud/repositorio-http';
import { Cotizacion, FiltrosCotizacion } from './cotizacion';
import { CotizacionesRepositorio, ResultadoFacturacion } from './cotizaciones-repositorio';

/**
 * Conexión al API: `{apiUrl}/cotizaciones` (filtros `texto`, `estado`, `desde`, `hasta`). El API genera `numero`,
 * toma nombre/teléfono/colegio de los registrados (404 si no son de la empresa) y recalcula `valorMensual` (suma de
 * los estudiantes), `meses` y `valorTotal`. Una cotización con `facturas` ya no se edita (409) ni se elimina.
 * `POST /cotizaciones/{id}/facturar {fechaEmision, concepto}` → `{cotizacion, facturas}`: exige acudiente y
 * estudiantes registrados (422) y aplica las reglas de las facturas (409 si se cruza con una vigente); la deja
 * APROBADA. Requiere `facturas.gestionar`.
 */
@Injectable()
export class CotizacionesHttp extends RepositorioHttp<Cotizacion, FiltrosCotizacion> implements CotizacionesRepositorio {
  protected readonly recurso = 'cotizaciones';

  facturar(id: string, fechaEmision: string, concepto: string): Observable<ResultadoFacturacion> {
    return this.http.post<ResultadoFacturacion>(`${this.url}/${encodeURIComponent(id)}/facturar`, { fechaEmision, concepto });
  }
}
