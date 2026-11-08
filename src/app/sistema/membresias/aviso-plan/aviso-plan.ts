import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { SuscripcionRepositorio } from '../suscripcion-repositorio';

const CLAVE_OCULTO = 'rutarola.aviso-plan.oculto';
/** Se avisa cuando a la prueba o al periodo pagado le quedan estos días o menos. */
export const DIAS_AVISO_PLAN = 15;

/**
 * Aviso del plan en el shell del administrador: la prueba o el periodo pagado terminan pronto, o la empresa
 * quedó en Gratis. Se puede ocultar durante la sesión del navegador.
 */
@Component({
  selector: 'app-aviso-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (mensaje(); as m) {
      <div role="status" class="alert alert-soft mb-4 flex-col sm:flex-row items-start sm:items-center" [class.alert-warning]="m.urgente" [class.alert-info]="!m.urgente">
        <i class="fa-solid fa-crown" aria-hidden="true"></i>
        <span class="grow text-sm">{{ m.texto }}</span>
        <div class="flex gap-2">
          <a routerLink="/sistema/membership" class="btn btn-sm btn-secondary">Ver planes</a>
          <button type="button" class="btn btn-sm btn-ghost" (click)="ocultar()" aria-label="Ocultar aviso"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
      </div>
    }
  `,
})
export class AvisoPlan {
  private readonly suscripcion = toSignal(inject(SuscripcionRepositorio).actual().pipe(catchError(() => of(null))), { initialValue: null });
  private readonly oculto = signal(leerOculto());

  protected readonly mensaje = computed(() => {
    const s = this.suscripcion();
    if (!s || this.oculto()) return null;
    const dias = s.diasRestantes ?? 0;
    if (s.estado === 'PRUEBA' && dias <= DIAS_AVISO_PLAN) {
      return { urgente: dias <= 5, texto: `Tu prueba gratuita termina en ${dias} día(s). Elige un plan para conservar el GPS en vivo y los recordatorios de cobro.` };
    }
    if (s.estado === 'ACTIVA' && dias <= DIAS_AVISO_PLAN) {
      return { urgente: dias <= 5, texto: `Tu plan ${s.nombrePlan} vence en ${dias} día(s). Renuévalo para no bajar al plan Gratis.` };
    }
    if (s.estado === 'GRATIS' && s.pruebaUsada) {
      return { urgente: false, texto: 'Estás en el plan Gratis: tus datos están a salvo. Mejora tu plan para activar el GPS en vivo, los recordatorios y más vehículos.' };
    }
    return null;
  });

  protected ocultar(): void {
    try {
      sessionStorage.setItem(CLAVE_OCULTO, '1');
    } catch {
      // Sin almacenamiento: solo se oculta en esta vista.
    }
    this.oculto.set(true);
  }
}

function leerOculto(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_OCULTO) === '1';
  } catch {
    return false;
  }
}
