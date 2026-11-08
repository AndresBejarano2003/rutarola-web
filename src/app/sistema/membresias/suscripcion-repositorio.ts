import { Observable } from 'rxjs';
import { AjusteSuscripcion, Checkout, PagoSuscripcion, PeriodoPago, Plan, PlanSuscripcion, Suscripcion } from './suscripcion';

/** Plan de la empresa, pagos con Wompi y (plataforma) ajuste manual del plan de una empresa. */
export abstract class SuscripcionRepositorio {
  abstract planes(): Observable<Plan[]>;
  abstract actual(): Observable<Suscripcion>;
  abstract pagos(): Observable<PagoSuscripcion[]>;
  abstract iniciarPago(plan: PlanSuscripcion, periodo: PeriodoPago): Observable<Checkout>;
  abstract verificarPago(referencia: string, idTransaccion: string): Observable<PagoSuscripcion>;
  // Plataforma
  abstract deEmpresa(empresaId: string): Observable<Suscripcion>;
  abstract pagosDeEmpresa(empresaId: string): Observable<PagoSuscripcion[]>;
  abstract ajustar(empresaId: string, ajuste: AjusteSuscripcion): Observable<Suscripcion>;
}
