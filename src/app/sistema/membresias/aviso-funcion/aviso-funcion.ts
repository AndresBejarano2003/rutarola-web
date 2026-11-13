import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlanEmpresa } from 'src/app/core/plan-empresa';
import { FuncionPlan, mensajeFuncionBloqueada } from '../suscripcion';

/**
 * Aviso en una pantalla que se puede consultar pero cuya función principal depende del plan (p. ej. ver las
 * programaciones guardadas sin poder crear recordatorios). No se muestra si el plan la incluye.
 */
@Component({
  selector: 'app-aviso-funcion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (mensaje(); as m) {
      <div role="status" class="alert alert-soft alert-info mb-4 flex-col sm:flex-row items-start sm:items-center">
        <i class="fa-solid fa-lock" aria-hidden="true"></i>
        <span class="grow text-sm">{{ m }}</span>
        <a routerLink="/sistema/membership" class="btn btn-sm btn-secondary">Ver planes</a>
      </div>
    }
  `,
})
export class AvisoFuncion {
  readonly funcion = input.required<FuncionPlan>();
  private readonly plan = inject(PlanEmpresa, { optional: true });

  protected readonly mensaje = computed(() => {
    const s = this.plan?.suscripcion();
    return s && !s.funciones.includes(this.funcion()) ? mensajeFuncionBloqueada(this.funcion(), s.nombrePlan) : null;
  });

  constructor() {
    void this.plan?.asegurar();
  }
}
