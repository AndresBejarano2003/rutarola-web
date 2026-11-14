import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlanEmpresa } from 'src/app/core/plan-empresa';
import { recordatorioGratis } from '../suscripcion';

/**
 * Insignia del plan en la barra superior del administrador: `FREE` en el plan Gratis (con un punto rojo si llegó a un
 * límite o amarillo si está cerca) y `PRUEBA · N d` durante la prueba. Los planes pagados no muestran nada. Lleva a
 * Planes y membresías.
 */
@Component({
  selector: 'app-insignia-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (insignia(); as i) {
      <a routerLink="/sistema/membership" class="btn btn-ghost btn-sm px-1.5 sm:px-2 relative" [attr.aria-label]="i.descripcion" [attr.title]="i.descripcion">
        <span class="badge badge-sm font-bold tracking-wide gap-1 {{ i.clase }}">
          <i [class]="i.icono" aria-hidden="true"></i>{{ i.texto }}
        </span>
        @if (i.punto) {
          <span class="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-base-100 {{ i.punto }}" aria-hidden="true"></span>
        }
      </a>
    }
  `,
})
export class InsigniaPlan {
  private readonly plan = inject(PlanEmpresa, { optional: true });

  protected readonly insignia = computed(() => {
    const s = this.plan?.suscripcion();
    if (!s || s.pendienteDecision) return null;
    if (s.estado === 'PRUEBA') {
      const dias = s.diasRestantes ?? 0;
      return {
        texto: `PRUEBA · ${dias} d`,
        icono: 'fa-solid fa-gift',
        clase: dias <= 3 ? 'badge-soft badge-warning' : 'badge-soft badge-info',
        punto: '',
        descripcion: `Prueba del plan ${s.nombrePlan}: te quedan ${dias} día(s). Ver planes`,
      };
    }
    const recordatorio = recordatorioGratis(s);
    if (!recordatorio) return null;
    return {
      texto: 'FREE',
      icono: 'fa-solid fa-seedling',
      clase: 'badge-outline border-primary text-primary',
      punto: recordatorio.nivel === 'LLENO' ? 'bg-error' : recordatorio.nivel === 'CERCA' ? 'bg-warning' : '',
      descripcion: `${recordatorio.texto} Ver planes`,
    };
  });

  constructor() {
    void this.plan?.asegurar();
  }
}
