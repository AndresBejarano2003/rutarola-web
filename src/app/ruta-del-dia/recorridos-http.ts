import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, auditTime, catchError, distinctUntilChanged, interval, map, merge, switchMap } from 'rxjs';
import { TiempoReal } from 'src/app/core/tiempo-real';
import { environment } from '@environments/environment';
import { EstadoParada, MotivoAusencia, Recorrido, RutaAsignada, Trayecto } from './recorrido';
import { RecorridosRepositorio } from './recorridos-repositorio';

/**
 * El empleado se toma de la SESIÓN (token), nunca de un parámetro: cada quien solo ve sus rutas.
 *
 * | Operación   | Petición |
 * |-------------|----------|
 * | rutasDelDia | `GET /recorridos/del-dia?fecha=YYYY-MM-DD` → `RutaAsignada[]` |
 * | obtener     | `GET /recorridos/{id}` (403 si no es de una asignación del empleado) |
 * | fotos       | `GET /recorridos/{id}/fotos` → `[{estudianteId, foto}]` (mismo acceso que `obtener`) |
 * | rutas (sync)| `observarRutasDelDia`: `GET /recorridos/del-dia` con cada `recorridoActualizado` del hub (le llegan al personal sin `Seguir`) y cada `INTERVALO_RESPALDO_MS` |
 * | iniciar     | `POST /recorridos` `{asignacionId, trayecto}` → 201 `Recorrido` con snapshot de ruta, colegio, vehículo y paradas (en la ENTREGA, AUSENTE + `NO_ASISTE` quien no asiste según la recogida de hoy); 200 con el EXISTENTE si ese trayecto ya se inició hoy (el compañero se une) |
 * | marcar      | `PATCH /recorridos/{id}/paradas` `{estudianteIds, estado, motivoAusencia?}` → `Recorrido` (`motivoAusencia` `NO_ASISTE`/`POR_SU_CUENTA` solo con AUSENTE, si no 400; `NO_ASISTE` en la entrega → 422) |
 * | reordenar   | `PUT /recorridos/{id}/orden` `{estudianteIds}` → `Recorrido` (guarda `ordenActualizado`) |
 * | finalizar   | `POST /recorridos/{id}/finalizar` `{observaciones}` → `Recorrido` |
 * | observar    | hub `/hubs/recorridos` (`core/tiempo-real.ts`): `Seguir(id)` → con cada `recorridoActualizado {recorridoId, fechaActualizacion, estado}` (y al reconectar) `GET /recorridos/{id}`; respaldo cada `INTERVALO_RESPALDO_MS` |
 *
 * El GPS (`POST /recorridos/{id}/gps`, última posición, trayecto, mapa) está en `gps/gps-http.ts`.
 *
 * Reglas (iguales a `RecorridosLocal`):
 * - 422: asignación inactiva, fuera de su periodo o de otro empleado; ruta inactiva o sin estudiantes;
 *   transición de estado no permitida (`transicionPermitida`); recorrido ya finalizado;
 *   finalizar con estudiantes pendientes o A BORDO (`motivoNoFinalizar`).
 * - 409: otro recorrido (del otro trayecto) EN_CURSO en la asignación ese mismo día;
 *   reordenar con una lista que no es EXACTAMENTE la de las paradas por visitar (`reordenarParadas`).
 * - 403: reordenar sin ser la monitora de la asignación (o el conductor si no tiene monitora) — `puedeReordenar`.
 * - El servidor guarda la hora de cada cambio y puede avisar al acudiente (recogido, entregado, no asistió).
 */
/** Modo local (sin hub): cada cuánto se consulta el recorrido en curso para ver los cambios del compañero. */
export const INTERVALO_SINCRONIZACION_MS = 10_000;
/** Con el hub: consulta de respaldo por si se perdió un aviso. */
export const INTERVALO_RESPALDO_MS = 60_000;

@Injectable()
export class RecorridosHttp extends RecorridosRepositorio {
  private readonly http = inject(HttpClient);
  private readonly tiempoReal = inject(TiempoReal);
  private readonly url = `${environment.apiUrl}/recorridos`;

  rutasDelDia(fecha: string): Observable<RutaAsignada[]> {
    return this.http.get<RutaAsignada[]>(`${this.url}/del-dia`, { params: { fecha } });
  }

  observarRutasDelDia(fecha: string): Observable<RutaAsignada[]> {
    return merge(this.tiempoReal.avisos(), interval(INTERVALO_RESPALDO_MS)).pipe(
      auditTime(500),
      switchMap(() => this.rutasDelDia(fecha).pipe(catchError(() => EMPTY))),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    );
  }

  obtener(id: string): Observable<Recorrido> {
    return this.http.get<Recorrido>(`${this.url}/${encodeURIComponent(id)}`);
  }

  fotos(id: string): Observable<Map<string, string>> {
    return this.http
      .get<{ estudianteId: string; foto: string }[]>(`${this.url}/${encodeURIComponent(id)}/fotos`)
      .pipe(map((lista) => new Map(lista.map((f) => [f.estudianteId, f.foto]))));
  }

  iniciar(asignacionId: string, trayecto: Trayecto): Observable<Recorrido> {
    return this.http.post<Recorrido>(this.url, { asignacionId, trayecto });
  }

  marcar(id: string, estudianteIds: string[], estado: EstadoParada, motivo?: MotivoAusencia): Observable<Recorrido> {
    const cuerpo = estado === 'AUSENTE' && motivo ? { estudianteIds, estado, motivoAusencia: motivo } : { estudianteIds, estado };
    return this.http.patch<Recorrido>(`${this.url}/${encodeURIComponent(id)}/paradas`, cuerpo);
  }

  reordenar(id: string, estudianteIds: string[]): Observable<Recorrido> {
    return this.http.put<Recorrido>(`${this.url}/${encodeURIComponent(id)}/orden`, { estudianteIds });
  }

  observar(id: string): Observable<Recorrido> {
    return merge(this.tiempoReal.cambiosDe(id), interval(INTERVALO_RESPALDO_MS)).pipe(
      auditTime(300),
      // Un fallo puntual (sin red) no corta la sincronización: se reintenta en el siguiente aviso.
      switchMap(() => this.obtener(id).pipe(catchError(() => EMPTY))),
      distinctUntilChanged((a, b) => a.fechaActualizacion === b.fechaActualizacion),
    );
  }

  finalizar(id: string, observaciones: string): Observable<Recorrido> {
    return this.http.post<Recorrido>(`${this.url}/${encodeURIComponent(id)}/finalizar`, { observaciones });
  }
}
