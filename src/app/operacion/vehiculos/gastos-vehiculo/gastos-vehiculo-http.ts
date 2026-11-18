import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RepositorioHttp } from 'src/app/shared/crud/repositorio-http';
import { FiltrosGasto, GastoVehiculo, ResumenGastos } from './gasto-vehiculo';
import { GastosVehiculoRepositorio } from './gastos-vehiculo-repositorio';

/**
 * `{apiUrl}/gastos` (`gastos.leer` / `gastos.gestionar`), CRUD estándar con filtros `vehiculoId`, `tipo`, `desde`,
 * `hasta` (fechas incluidas) y `texto` (descripción, proveedor, referencia); más recientes primero.
 * `GET /gastos/resumen?<filtros>` → `ResumenGastos`. 400: sin vehículo/tipo/fecha, valor ≤ 0, combustible sin galones,
 * archivo no válido (PDF/imagen ≤ 2 MB); 422 fecha futura; 404 vehículo de otra empresa. Un vehículo con gastos no se
 * elimina (409, se inactiva).
 */
@Injectable()
export class GastosVehiculoHttp extends RepositorioHttp<GastoVehiculo, FiltrosGasto> implements GastosVehiculoRepositorio {
  protected readonly recurso = 'gastos';

  resumen(filtros: FiltrosGasto): Observable<ResumenGastos> {
    return this.http.get<ResumenGastos>(`${this.url}/resumen`, { params: this.aParametros(filtros) });
  }
}
