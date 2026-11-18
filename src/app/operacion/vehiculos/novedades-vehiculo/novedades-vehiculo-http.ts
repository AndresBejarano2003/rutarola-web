import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { FiltrosNovedad, NovedadVehiculo, SolicitudEstadoNovedad, SolicitudNovedad } from './novedad-vehiculo';
import { NovedadesVehiculoRepositorio } from './novedades-vehiculo-repositorio';

/**
 * `{apiUrl}/novedades-vehiculo`:
 * - Administrador (`vehiculos.leer` / `vehiculos.gestionar`): `GET ?vehiculoId=&estado=&tipo=&abiertas=` (máx. 200,
 *   abiertas y graves primero), `GET /{id}` (con el archivo), `POST` (201), `PUT /{id}/estado {estado, respuesta}`
 *   (RESUELTA exige respuesta → 400).
 * - Conductor/monitora (`novedades.reportar`): `GET /mis-vehiculos` → `[{id, nombre}]`, `GET /mias`, `GET /mias/{id}`,
 *   `POST /mias` (201; 422 si el vehículo no es de sus asignaciones vigentes o próximas).
 * 400: sin vehículo/tipo/gravedad, descripción de menos de 10 caracteres, archivo no válido (PDF/imagen ≤ 2 MB).
 * Las nuevas del personal llegan a la campana de los administradores (CRÍTICA si la gravedad es ALTA).
 */
@Injectable()
export class NovedadesVehiculoHttp extends NovedadesVehiculoRepositorio {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/novedades-vehiculo`;

  listar(f: FiltrosNovedad): Observable<NovedadVehiculo[]> {
    let params = new HttpParams();
    if (f.vehiculoId) params = params.set('vehiculoId', f.vehiculoId);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.abiertas) params = params.set('abiertas', 'true');
    return this.http.get<NovedadVehiculo[]>(this.url, { params });
  }

  obtener(id: string): Observable<NovedadVehiculo> {
    return this.http.get<NovedadVehiculo>(`${this.url}/${encodeURIComponent(id)}`);
  }

  registrar(s: SolicitudNovedad): Observable<NovedadVehiculo> {
    return this.http.post<NovedadVehiculo>(this.url, s);
  }

  cambiarEstado(id: string, s: SolicitudEstadoNovedad): Observable<NovedadVehiculo> {
    return this.http.put<NovedadVehiculo>(`${this.url}/${encodeURIComponent(id)}/estado`, s);
  }

  misVehiculos(): Observable<OpcionCatalogo[]> {
    return this.http.get<OpcionCatalogo[]>(`${this.url}/mis-vehiculos`);
  }

  mias(): Observable<NovedadVehiculo[]> {
    return this.http.get<NovedadVehiculo[]>(`${this.url}/mias`);
  }

  obtenerMia(id: string): Observable<NovedadVehiculo> {
    return this.http.get<NovedadVehiculo>(`${this.url}/mias/${encodeURIComponent(id)}`);
  }

  reportar(s: SolicitudNovedad): Observable<NovedadVehiculo> {
    return this.http.post<NovedadVehiculo>(`${this.url}/mias`, s);
  }
}
