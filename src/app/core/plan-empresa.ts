import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { DecisionGratis, FuncionPlan, Suscripcion, mensajeFuncionBloqueada } from 'src/app/sistema/membresias/suscripcion';
import { SuscripcionRepositorio } from 'src/app/sistema/membresias/suscripcion-repositorio';

/**
 * Plan de la empresa del administrador, compartido por el shell (aviso, decisión al vencer), el menú (candados) y las
 * guardias de las pantallas que dependen del plan. Se provee junto a los repositorios (`core/repositorios.ts`).
 * Las reglas las aplica el servidor (403 con el mensaje); esto solo evita entrar a una pantalla que no se puede usar.
 */
@Injectable()
export class PlanEmpresa {
  private readonly repositorio = inject(SuscripcionRepositorio);
  private readonly _suscripcion = signal<Suscripcion | null>(null);
  private carga: Promise<Suscripcion | null> | null = null;

  readonly suscripcion = this._suscripcion.asReadonly();
  /** Venció la prueba o el plan: el administrador debe pagar o seguir en Gratis. */
  readonly pendienteDecision = computed(() => this._suscripcion()?.pendienteDecision ?? false);

  /** Primera lectura (una sola petición aunque la pidan varios a la vez). */
  asegurar(): Promise<Suscripcion | null> {
    this.carga ??= this.recargar();
    return this.carga;
  }

  async recargar(): Promise<Suscripcion | null> {
    try {
      const s = await firstValueFrom(this.repositorio.actual());
      this._suscripcion.set(s);
      return s;
    } catch {
      return this._suscripcion();
    }
  }

  establecer(s: Suscripcion): void {
    this._suscripcion.set(s);
    this.carga = Promise.resolve(s);
  }

  /** Sigue en Gratis: el servidor inactiva lo que supere los límites. */
  async continuarGratis(): Promise<DecisionGratis> {
    const decision = await firstValueFrom(this.repositorio.continuarGratis());
    this.establecer(decision.suscripcion);
    return decision;
  }

  /** Sin datos todavía cuenta como disponible (el servidor decide). */
  tiene(funcion: FuncionPlan): boolean {
    const s = this._suscripcion();
    return !s || s.funciones.includes(funcion);
  }
}

/**
 * La pantalla exige una función del plan. Sin ella → Planes y membresías con un aviso de desde qué plan está
 * disponible (`?funcion=`).
 */
export function conFuncion(funcion: FuncionPlan): CanActivateFn {
  return async () => {
    const plan = inject(PlanEmpresa);
    const router = inject(Router);
    const avisos = inject(NotificacionesService);
    const s = await plan.asegurar();
    if (!s || s.funciones.includes(funcion)) return true;
    avisos.info(mensajeFuncionBloqueada(funcion, s.nombrePlan));
    return router.createUrlTree(['/sistema/membership'], { queryParams: { funcion } });
  };
}
