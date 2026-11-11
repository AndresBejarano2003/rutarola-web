import { Observable } from 'rxjs';
import { ValidacionCodigo } from 'src/app/plataforma/codigos-promocionales/codigo-promocional';
import { AjusteSuscripcion, Checkout, PagoSuscripcion, PeriodoPago, Plan, PlanSuscripcion, Suscripcion } from './suscripcion';

/** Plan de la empresa, pagos con Wompi y (plataforma) ajuste manual del plan de una empresa. */
export abstract class SuscripcionRepositorio {
  abstract planes(): Observable<Plan[]>;
  abstract actual(): Observable<Suscripcion>;
  abstract pagos(): Observable<PagoSuscripcion[]>;
  /** 422 (`ErrorCrud` VALIDACION en local) con el motivo si el código no aplica a ese plan y periodo. */
  abstract validarCodigo(codigo: string, plan: PlanSuscripcion, periodo: PeriodoPago): Observable<ValidacionCodigo>;
  /** Con `codigoPromocional` el valor ya trae el descuento del primer mes. */
  abstract iniciarPago(plan: PlanSuscripcion, periodo: PeriodoPago, codigoPromocional?: string): Observable<Checkout>;
  abstract verificarPago(referencia: string, idTransaccion: string): Observable<PagoSuscripcion>;
  // Plataforma
  abstract deEmpresa(empresaId: string): Observable<Suscripcion>;
  abstract pagosDeEmpresa(empresaId: string): Observable<PagoSuscripcion[]>;
  abstract ajustar(empresaId: string, ajuste: AjusteSuscripcion): Observable<Suscripcion>;
}
