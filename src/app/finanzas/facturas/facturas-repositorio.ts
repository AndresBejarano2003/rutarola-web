import { Observable } from 'rxjs';
import { RepositorioCrud } from 'src/app/shared/crud/repositorio-crud';
import { CuotaFactura, Factura, FiltrosFactura } from './factura';

/** Token de acceso a datos de facturas (implementación en `core/repositorios.ts`). */
export abstract class FacturasRepositorio extends RepositorioCrud<Factura, FiltrosFactura> {
  /** Cuotas con lo pagado y el saldo. `sinRecibo`: sin contar ese recibo (al editarlo). */
  abstract cuotas(id: string, sinRecibo?: string): Observable<CuotaFactura[]>;
  /** Registra el retiro desde `periodoRetiro` (deja de cobrar desde ese mes) o lo quita con `''`. */
  abstract retiro(id: string, periodoRetiro: string, motivo: string): Observable<Factura>;
}
