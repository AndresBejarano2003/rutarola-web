import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { Observable, catchError, defer, map, switchMap, throwError } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthService } from 'src/app/core/auth';
import { RenovacionSesion } from 'src/app/core/interceptor-autenticacion';
import { TiempoReal } from 'src/app/core/tiempo-real';
import { esAppNativa } from './fuente-ubicacion';
import { LecturaGps, PosicionGps, RecorridoEnMapa, ResultadoLoteGps } from './gps';
import { GpsRepositorio } from './gps-repositorio';

/**
 * | Operación       | Petición |
 * |-----------------|----------|
 * | enviar          | `POST /recorridos/{id}/gps {posiciones: LecturaGps[]}` (≤ 500, `gps.reportar`, solo el personal del recorrido) → `{recibidas, descartadas, ultima}` |
 * | ultima          | `GET /recorridos/{id}/gps/ultima` → `PosicionGps` o 204 (acudiente: solo EN_CURSO y de su estudiante) |
 * | trayecto        | `GET /recorridos/{id}/gps?desde=` (administrador y personal; 403 al acudiente) |
 * | enCurso         | `GET /recorridos/en-curso` → `RecorridoEnMapa[]` (`recorridos.leer`) |
 * | observar        | hub `/hubs/recorridos`: `Seguir(id)` → eventos `posicion` |
 * | observarEmpresa | hub: `SeguirEmpresa()` → `posicion` de todos y `recorridoActualizado` |
 *
 * Repetidas (misma fecha) y lecturas fuera de inicio − 5 min … fin + 5 min se descartan, así que un lote
 * guardado sin red se puede enviar aunque el recorrido ya haya terminado. Las ubicaciones se borran
 * a los `Gps:DiasRetencion` días (30 por defecto).
 *
 * En la app instalada el lote se envía con HTTP NATIVO (`CapacitorHttp`): tras 5 min en segundo plano Android frena
 * las peticiones del WebView. Como no pasa por el interceptor, agrega el token y, ante un 401, renueva una vez.
 */
@Injectable()
export class GpsHttp extends GpsRepositorio {
  private readonly http = inject(HttpClient);
  private readonly tiempoReal = inject(TiempoReal);
  private readonly url = `${environment.apiUrl}/recorridos`;

  private readonly auth = inject(AuthService);
  private readonly renovacion = inject(RenovacionSesion);

  enviar(recorridoId: string, lecturas: LecturaGps[]): Observable<ResultadoLoteGps> {
    const url = `${this.url}/${encodeURIComponent(recorridoId)}/gps`;
    const cuerpo = { posiciones: lecturas };
    if (!esAppNativa()) return this.http.post<ResultadoLoteGps>(url, cuerpo);
    return defer(() => this.postNativo(url, cuerpo)).pipe(
      catchError((e: unknown) =>
        e instanceof HttpErrorResponse && e.status === 401
          ? this.renovacion.renovar().pipe(switchMap(() => this.postNativo(url, cuerpo)))
          : throwError(() => e),
      ),
    );
  }

  private async postNativo(url: string, data: unknown): Promise<ResultadoLoteGps> {
    const token = this.auth.tokens()?.accessToken;
    let r;
    try {
      r = await CapacitorHttp.post({
        url,
        data,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        connectTimeout: 20_000,
        readTimeout: 20_000,
      });
    } catch {
      throw new HttpErrorResponse({ status: 0, url, statusText: 'Sin conexión' });
    }
    if (r.status >= 200 && r.status < 300) return r.data as ResultadoLoteGps;
    throw new HttpErrorResponse({ status: r.status, error: r.data, url });
  }

  ultima(recorridoId: string): Observable<PosicionGps | null> {
    return this.http
      .get<PosicionGps | null>(`${this.url}/${encodeURIComponent(recorridoId)}/gps/ultima`, { observe: 'response' })
      .pipe(map((r) => (r.status === 204 ? null : r.body)));
  }

  trayecto(recorridoId: string): Observable<PosicionGps[]> {
    return this.http.get<PosicionGps[]>(`${this.url}/${encodeURIComponent(recorridoId)}/gps`);
  }

  enCurso(): Observable<RecorridoEnMapa[]> {
    return this.http.get<RecorridoEnMapa[]>(`${this.url}/en-curso`);
  }

  observar(recorridoId: string): Observable<PosicionGps> {
    return this.tiempoReal.posicionesDe(recorridoId);
  }

  observarEmpresa(): Observable<PosicionGps | null> {
    // Cualquier cambio (inicio, paradas, fin) vuelve a pedir la lista: cambia el conteo de cada ruta.
    return this.tiempoReal.empresaCompleta().pipe(map((e) => ('posicion' in e ? e.posicion : null)));
  }
}
