import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { AjusteSuscripcion, Checkout, PagoSuscripcion, PeriodoPago, Plan, PlanSuscripcion, Suscripcion } from './suscripcion';
import { SuscripcionRepositorio } from './suscripcion-repositorio';

/**
 * - `GET /suscripcion/planes` (público) → `Plan[]`;
 * - `GET /suscripcion` (`suscripcion.leer`) → `Suscripcion` (crea la prueba si no existía; si venció la baja a GRATIS);
 * - `GET /suscripcion/pagos` → `PagoSuscripcion[]` (más recientes primero);
 * - `POST /suscripcion/pagos {plan, periodo}` (`suscripcion.gestionar`) → 201 `Checkout` (URL firmada del Web
 *   Checkout de Wompi); 400 plan GRATIS; 422 si los pagos en línea no están configurados;
 * - `POST /suscripcion/pagos/{referencia}/verificacion {idTransaccion}` → `PagoSuscripcion` (el servidor consulta
 *   la transacción en Wompi; el plan se activa SOLO con la confirmación de Wompi, también por el evento firmado
 *   `POST /pagos/wompi/eventos`); 404 si el pago no es de la empresa;
 * - Plataforma (`empresas.gestionar`): `GET/PUT /empresas/{id}/suscripcion` (422 fecha de fin pasada) y
 *   `GET /empresas/{id}/suscripcion/pagos`.
 * Crear o activar vehículos/estudiantes por encima del plan responde 422 con el límite.
 */
@Injectable()
export class SuscripcionHttp extends SuscripcionRepositorio {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/suscripcion`;
  private readonly empresas = `${environment.apiUrl}/empresas`;

  planes(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.url}/planes`);
  }

  actual(): Observable<Suscripcion> {
    return this.http.get<Suscripcion>(this.url);
  }

  pagos(): Observable<PagoSuscripcion[]> {
    return this.http.get<PagoSuscripcion[]>(`${this.url}/pagos`);
  }

  iniciarPago(plan: PlanSuscripcion, periodo: PeriodoPago): Observable<Checkout> {
    return this.http.post<Checkout>(`${this.url}/pagos`, { plan, periodo });
  }

  verificarPago(referencia: string, idTransaccion: string): Observable<PagoSuscripcion> {
    return this.http.post<PagoSuscripcion>(`${this.url}/pagos/${encodeURIComponent(referencia)}/verificacion`, { idTransaccion });
  }

  deEmpresa(empresaId: string): Observable<Suscripcion> {
    return this.http.get<Suscripcion>(`${this.empresas}/${encodeURIComponent(empresaId)}/suscripcion`);
  }

  pagosDeEmpresa(empresaId: string): Observable<PagoSuscripcion[]> {
    return this.http.get<PagoSuscripcion[]>(`${this.empresas}/${encodeURIComponent(empresaId)}/suscripcion/pagos`);
  }

  ajustar(empresaId: string, a: AjusteSuscripcion): Observable<Suscripcion> {
    return this.http.put<Suscripcion>(`${this.empresas}/${encodeURIComponent(empresaId)}/suscripcion`, {
      ...a,
      periodo: a.periodo || null,
      fechaFin: a.fechaFin || null,
    });
  }
}
