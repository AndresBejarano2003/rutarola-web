import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MESES_PAGADOS_POR_ANIO, MESES_PRUEBA, PLANES, PeriodoPago } from '../suscripcion';
import { TarjetaPlan } from '../tarjeta-plan/tarjeta-plan';

/** Planes sin iniciar sesión (`/offline-membership`, enlazada desde el login): invita a registrarse con la prueba. */
@Component({
  selector: 'app-planes-publicos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TarjetaPlan],
  templateUrl: './planes-publicos-page.html',
})
export default class PlanesPublicosPage {
  private readonly router = inject(Router);
  protected readonly planes = PLANES;
  protected readonly mesesPrueba = MESES_PRUEBA;
  protected readonly mesesGratisAnual = 12 - MESES_PAGADOS_POR_ANIO;
  protected readonly periodo = signal<PeriodoPago>('MENSUAL');

  protected registrarse(): void {
    void this.router.navigateByUrl('/registro');
  }
}
