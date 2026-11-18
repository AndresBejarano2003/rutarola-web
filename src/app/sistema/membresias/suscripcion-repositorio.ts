import { Observable } from 'rxjs';
import { ValidacionCodigo } from 'src/app/plataforma/codigos-promocionales/codigo-promocional';
import {
  AjusteSuscripcion,
  Checkout,
  CondicionesRegistro,
  PagoSuscripcion,
  ParametroPlataforma,
  PeriodoPago,
  Plan,
  PlanSuscripcion,
  Suscripcion,
} from './suscripcion';

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
  /** Días de prueba vigentes hoy (público: registro y precios). */
  abstract condiciones(): Observable<CondicionesRegistro>;
  /** En Gratis sin haber usado la prueba: inicia los días de Profesional que fija la plataforma (422 si ya la usó o tiene un plan). */
  abstract iniciarPrueba(): Observable<Suscripcion>;
  // Plataforma: parámetros globales (días de prueba y de aviso, precios de los planes)
  abstract parametrosPlataforma(): Observable<ParametroPlataforma[]>;
  abstract actualizarParametroPlataforma(clave: string, valor: string): Observable<ParametroPlataforma>;
  // Plataforma
  abstract deEmpresa(empresaId: string): Observable<Suscripcion>;
  abstract pagosDeEmpresa(empresaId: string): Observable<PagoSuscripcion[]>;
  abstract ajustar(empresaId: string, ajuste: AjusteSuscripcion): Observable<Suscripcion>;
}
