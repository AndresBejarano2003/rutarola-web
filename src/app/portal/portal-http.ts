import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, interval, merge } from 'rxjs';
import { TiempoReal } from 'src/app/core/tiempo-real';
import { environment } from '@environments/environment';
import { AvisoAusencia, SolicitudAvisoAusencia } from 'src/app/ruta-del-dia/avisos-ausencia';
import { PortalAcudiente } from './portal';
import { PortalRepositorio } from './portal-repositorio';

/**
 * `GET {apiUrl}/portal` → `PortalAcudiente` del acudiente del token (403 para otros roles).
 * El servidor arma lo mismo que `PortalLocal`: estudiantes del acudiente (colegio, horario del curso,
 * ruta activa con su asignación vigente y recorrido de hoy), estado de cuenta con las reglas de
 * `calcularEstadoCuenta`, recibos (válidos y anulados) y cotizaciones con su `acudienteId`.
 * Solo lectura, salvo los avisos de ausencia: `POST {apiUrl}/portal/avisos` → 201 `AvisoAusencia` (404 estudiante ajeno,
 * 409 ya hay aviso ese día, 422 fecha fuera de hoy…+30 o trayecto ya terminado) y `DELETE /portal/avisos/{id}` → 204
 * (422 si ya lo confirmaron o es de un día pasado). Cada estudiante trae sus `avisos` de hoy en adelante.
 * `observarCambios`: hub `/hubs/recorridos`; el servidor envía `recorridoActualizado` al acudiente de
 * cada estudiante del recorrido sin que lo pida (grupo del acudiente). Respaldo cada 2 minutos.
 */
@Injectable()
export class PortalHttp extends PortalRepositorio {
  private readonly http = inject(HttpClient);
  private readonly tiempoReal = inject(TiempoReal);

  obtener(): Observable<PortalAcudiente> {
    return this.http.get<PortalAcudiente>(`${environment.apiUrl}/portal`);
  }

  crearAviso(solicitud: SolicitudAvisoAusencia): Observable<AvisoAusencia> {
    return this.http.post<AvisoAusencia>(`${environment.apiUrl}/portal/avisos`, solicitud);
  }

  cancelarAviso(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/portal/avisos/${encodeURIComponent(id)}`);
  }

  observarCambios(): Observable<unknown> {
    return merge(this.tiempoReal.avisos(), interval(120_000));
  }
}
