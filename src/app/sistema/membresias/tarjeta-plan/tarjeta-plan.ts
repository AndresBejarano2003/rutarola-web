import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PeriodoPago, Plan, costoPorEstudiante, mensualEquivalente } from '../suscripcion';

/** Tarjeta de un plan (pantalla de membresías y página pública de planes). */
@Component({
  selector: 'app-tarjeta-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
  templateUrl: './tarjeta-plan.html',
  host: { class: 'block' },
})
export class TarjetaPlan {
  readonly plan = input.required<Plan>();
  readonly periodo = input<PeriodoPago>('MENSUAL');
  readonly actual = input(false);
  readonly textoBoton = input.required<string>();
  readonly deshabilitado = input(false);
  readonly elegir = output<void>();

  protected readonly mensualEquivalente = mensualEquivalente;
  protected readonly costoPorEstudiante = costoPorEstudiante;

  protected ahorro(p: Plan): number {
    return p.precioMensual * 12 - p.precioAnual;
  }
}
