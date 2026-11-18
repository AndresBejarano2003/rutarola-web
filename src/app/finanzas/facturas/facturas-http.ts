import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RepositorioHttp } from 'src/app/shared/crud/repositorio-http';
import { CuotaFactura, Factura, FiltrosFactura } from './factura';
import { FacturasRepositorio } from './facturas-repositorio';

/**
 * Conexión al API: `{apiUrl}/facturas` (filtros `texto`, `acudienteId`,
 * `estudianteId`, `estado`). El API genera `numero` y valida: el estudiante
 * pertenece al acudiente, una sola factura vigente por estudiante en
 * periodos que se crucen (409), y `DELETE` responde 409 si tiene recibos o
 * programación. Además:
 * - `GET /facturas/{id}/cuotas?sinRecibo=` → `CuotaFactura[]` (meses que se cobran, pagado, saldo, fecha límite, estado).
 * - `PUT /facturas/{id}/retiro {periodoRetiro, motivo}` → la factura. Retiro entre el segundo y el último mes; 422 si
 *   hay pagos desde ese mes o la factura está anulada; `periodoRetiro ""` lo quita. El servidor también lo registra
 *   (desde el mes siguiente o después del último pagado) al inactivar al estudiante o al acudiente.
 */
@Injectable()
export class FacturasHttp extends RepositorioHttp<Factura, FiltrosFactura> implements FacturasRepositorio {
  protected readonly recurso = 'facturas';

  cuotas(id: string, sinRecibo?: string): Observable<CuotaFactura[]> {
    return this.http.get<CuotaFactura[]>(`${this.url}/${encodeURIComponent(id)}/cuotas`, { params: sinRecibo ? { sinRecibo } : {} });
  }

  retiro(id: string, periodoRetiro: string, motivo: string): Observable<Factura> {
    return this.http.put<Factura>(`${this.url}/${encodeURIComponent(id)}/retiro`, { periodoRetiro, motivo });
  }
}
