import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { DocumentoVehiculo, SolicitudDocumentoVehiculo } from './documento-vehiculo';
import { DocumentosVehiculoRepositorio } from './documentos-vehiculo-repositorio';

/**
 * `{apiUrl}/vehiculos/{vehiculoId}/documentos` (`vehiculos.leer` / `vehiculos.gestionar`):
 * - `GET` → `DocumentoVehiculo[]` (archivos con `url: ''`), `GET /{id}` → con el contenido;
 * - `POST` → 201, `PUT /{id}`, `DELETE /{id}` → 204 (borra también el archivo).
 * 400 sin tipo o vencimiento, vencimiento antes de la expedición o archivo no válido (PDF/imagen ≤ 2 MB);
 * 404 vehículo de otra empresa. Cada escritura deja el vencimiento del vehículo con el registro más reciente del tipo.
 */
@Injectable()
export class DocumentosVehiculoHttp extends DocumentosVehiculoRepositorio {
  private readonly http = inject(HttpClient);

  private url(vehiculoId: string, id?: string): string {
    const base = `${environment.apiUrl}/vehiculos/${encodeURIComponent(vehiculoId)}/documentos`;
    return id ? `${base}/${encodeURIComponent(id)}` : base;
  }

  listar(vehiculoId: string): Observable<DocumentoVehiculo[]> {
    return this.http.get<DocumentoVehiculo[]>(this.url(vehiculoId));
  }

  obtener(vehiculoId: string, id: string): Observable<DocumentoVehiculo> {
    return this.http.get<DocumentoVehiculo>(this.url(vehiculoId, id));
  }

  crear(vehiculoId: string, s: SolicitudDocumentoVehiculo): Observable<DocumentoVehiculo> {
    return this.http.post<DocumentoVehiculo>(this.url(vehiculoId), s);
  }

  actualizar(vehiculoId: string, id: string, s: SolicitudDocumentoVehiculo): Observable<DocumentoVehiculo> {
    return this.http.put<DocumentoVehiculo>(this.url(vehiculoId, id), s);
  }

  eliminar(vehiculoId: string, id: string): Observable<void> {
    return this.http.delete<void>(this.url(vehiculoId, id));
  }
}
