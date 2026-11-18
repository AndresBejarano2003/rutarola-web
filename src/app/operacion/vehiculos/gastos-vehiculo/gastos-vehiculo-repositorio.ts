import { Observable } from 'rxjs';
import { RepositorioCrud } from 'src/app/shared/crud/repositorio-crud';
import { FiltrosGasto, GastoVehiculo, ResumenGastos } from './gasto-vehiculo';

/**
 * Gastos de los vehículos (tanqueadas, mantenimientos, repuestos…) con su tablero. Implementaciones:
 * `GastosVehiculoLocal` → `GastosVehiculoHttp`.
 */
export abstract class GastosVehiculoRepositorio extends RepositorioCrud<GastoVehiculo, FiltrosGasto> {
  /** Totales, por tipo, por mes, por vehículo y rendimiento de lo que cumple los filtros. */
  abstract resumen(filtros: FiltrosGasto): Observable<ResumenGastos>;
}
