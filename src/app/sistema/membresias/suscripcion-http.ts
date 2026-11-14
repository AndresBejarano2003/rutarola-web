import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ValidacionCodigo } from 'src/app/plataforma/codigos-promocionales/codigo-promocional';
import {
  AjusteSuscripcion,
  Checkout,
  CondicionesRegistro,
  DecisionGratis,
  PagoSuscripcion,
  ParametroPlataforma,
  PeriodoPago,
  Plan,
  PlanSuscripcion,
  Suscripcion,
} from './suscripcion';
import { SuscripcionRepositorio } from './suscripcion-repositorio';

/**
 * - `GET /suscripcion/planes` (público) → `Plan[]`;
 * - `GET /suscripcion` (`suscripcion.leer`) → `Suscripcion` (crea la prueba si no existía; si venció la baja a GRATIS);
 * - `GET /suscripcion/pagos` → `PagoSuscripcion[]` (más recientes primero);
 * - `POST /suscripcion/codigo {codigo, plan, periodo}` (`suscripcion.gestionar`) → `ValidacionCodigo` o 422 con el
 *   motivo (no existe/inactivo, aún no empieza o venció, otro plan o periodo, no es para esta empresa o solo primera
 *   compra, usos agotados). El descuento es SOLO del primer mes;
 * - `POST /suscripcion/pagos {plan, periodo, codigoPromocional}` (`suscripcion.gestionar`) → 201 `Checkout` (URL firmada
 *   del Web Checkout de Wompi, con el descuento); 400 plan GRATIS; 422 si el código no aplica o si los pagos en línea no
 *   están configurados. Si el código deja el total en $0 el plan se activa de una vez (`url` vacía, también sin Wompi).
 *   El uso del código cuenta cuando el pago queda aprobado;
 * - `POST /suscripcion/pagos/{referencia}/verificacion {idTransaccion}` → `PagoSuscripcion` (el servidor consulta
 *   la transacción en Wompi; el plan se activa SOLO con la confirmación de Wompi, también por el evento firmado
 *   `POST /pagos/wompi/eventos`); 404 si el pago no es de la empresa;
 * - Plataforma (`empresas.gestionar`): `GET/PUT /empresas/{id}/suscripcion` (422 fecha de fin pasada o código que no
 *   aplica; `codigoPromocional` solo con ACTIVA) y
 *   `GET /empresas/{id}/suscripcion/pagos`.
 * - `GET /suscripcion/condiciones` (público) → `{diasPrueba, planPrueba, nombrePlanPrueba}`;
 * - `POST /suscripcion/continuar-gratis` (`suscripcion.gestionar`) → `DecisionGratis` (inactiva los vehículos y
 *   estudiantes que superan Gratis, conservando primero los que están en uso); 422 si no hay decisión pendiente;
 * - Plataforma: `GET /plataforma/parametros`, `PUT /plataforma/parametros/{clave} {valor}` (`empresas.gestionar`;
 *   400 fuera de rango; `suscripcion.dias_prueba` 1–90).
 * Crear o activar vehículos/estudiantes por encima del plan responde 422 con el límite. Una función que el plan no
 * incluye responde 403 con el mensaje (reportes, GPS en vivo, crear recordatorios).
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

  validarCodigo(codigo: string, plan: PlanSuscripcion, periodo: PeriodoPago): Observable<ValidacionCodigo> {
    return this.http.post<ValidacionCodigo>(`${this.url}/codigo`, { codigo, plan, periodo });
  }

  iniciarPago(plan: PlanSuscripcion, periodo: PeriodoPago, codigoPromocional = ''): Observable<Checkout> {
    return this.http.post<Checkout>(`${this.url}/pagos`, { plan, periodo, codigoPromocional });
  }

  verificarPago(referencia: string, idTransaccion: string): Observable<PagoSuscripcion> {
    return this.http.post<PagoSuscripcion>(`${this.url}/pagos/${encodeURIComponent(referencia)}/verificacion`, { idTransaccion });
  }

  condiciones(): Observable<CondicionesRegistro> {
    return this.http.get<CondicionesRegistro>(`${this.url}/condiciones`);
  }

  continuarGratis(): Observable<DecisionGratis> {
    return this.http.post<DecisionGratis>(`${this.url}/continuar-gratis`, {});
  }

  iniciarPrueba(): Observable<Suscripcion> {
    return this.http.post<Suscripcion>(`${this.url}/prueba`, {});
  }

  parametrosPlataforma(): Observable<ParametroPlataforma[]> {
    return this.http.get<ParametroPlataforma[]>(`${environment.apiUrl}/plataforma/parametros`);
  }

  actualizarParametroPlataforma(clave: string, valor: string): Observable<ParametroPlataforma> {
    return this.http.put<ParametroPlataforma>(`${environment.apiUrl}/plataforma/parametros/${encodeURIComponent(clave)}`, { valor });
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
