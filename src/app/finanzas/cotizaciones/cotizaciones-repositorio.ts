import { Observable } from 'rxjs';
import { RepositorioCrud } from 'src/app/shared/crud/repositorio-crud';
import { Factura } from '../facturas/factura';
import { Cotizacion, FiltrosCotizacion } from './cotizacion';

export interface ResultadoFacturacion {
  cotizacion: Cotizacion;
  facturas: Factura[];
}

/** Token de acceso a datos de cotizaciones (implementación en `core/repositorios.ts`). */
export abstract class CotizacionesRepositorio extends RepositorioCrud<Cotizacion, FiltrosCotizacion> {
  /** Aprueba la cotización y crea una factura vigente por estudiante (todo o nada). */
  abstract facturar(id: string, fechaEmision: string, concepto: string): Observable<ResultadoFacturacion>;
}
