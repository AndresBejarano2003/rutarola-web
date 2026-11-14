import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '@environments/environment';
import { Router, RouterLink } from '@angular/router';
import { CondicionesRegistro, DIAS_PRUEBA_POR_DEFECTO, MESES_PAGADOS_POR_ANIO, PLANES, PeriodoPago, Plan } from '../suscripcion';
import { TarjetaPlan } from '../tarjeta-plan/tarjeta-plan';

/**
 * Planes sin iniciar sesión (`/offline-membership`, enlazada desde el login): invita a registrarse con la prueba o a pagar
 * un plan de una vez. Está fuera de los repositorios, así que lee los días de prueba con `GET /suscripcion/condiciones`.
 */
@Component({
  selector: 'app-planes-publicos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TarjetaPlan],
  templateUrl: './planes-publicos-page.html',
})
export default class PlanesPublicosPage {
  private readonly router = inject(Router);
  protected readonly planes = PLANES;
  protected readonly diasPrueba = signal(DIAS_PRUEBA_POR_DEFECTO);
  protected readonly mesesGratisAnual = 12 - MESES_PAGADOS_POR_ANIO;
  protected readonly periodo = signal<PeriodoPago>('MENSUAL');

  constructor() {
    if (environment.usarApi) {
      inject(HttpClient)
        .get<CondicionesRegistro>(`${environment.apiUrl}/suscripcion/condiciones`)
        .pipe(takeUntilDestroyed())
        .subscribe({ next: (c) => this.diasPrueba.set(c.diasPrueba), error: () => undefined });
    }
  }

  protected registrarse(): void {
    void this.router.navigateByUrl('/registro');
  }

  /** Se registra en el plan Gratis (no vence). */
  protected empezarGratis(): void {
    void this.router.navigate(['/registro'], { queryParams: { comienzo: 'GRATIS' } });
  }

  /** Paga ese plan de una vez, sin prueba. */
  protected pagarAhora(p: Plan): void {
    void this.router.navigate(['/registro'], { queryParams: { plan: p.id, periodo: this.periodo() } });
  }
}
