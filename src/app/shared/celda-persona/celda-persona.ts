import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Avatar } from '../foto/avatar';

/** Celda de tabla con avatar (foto de perfil o iniciales), nombre y un detalle opcional debajo. */
@Component({
  selector: 'app-celda-persona',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar],
  host: { class: 'flex items-center gap-3' },
  template: `
    <app-avatar [foto]="foto()" [iniciales]="iniciales()" [tono]="activo() ? 'primario' : 'neutro'" />
    <div class="min-w-0">
      <div class="font-semibold text-base-content truncate">{{ nombre() }}</div>
      @if (detalle()) {
        <div class="text-xs text-base-content/70 truncate">{{ detalle() }}</div>
      }
    </div>
  `,
})
export class CeldaPersona {
  readonly nombre = input.required<string>();
  readonly iniciales = input.required<string>();
  /** Data URL de la foto; vacía = iniciales. */
  readonly foto = input<string | null | undefined>('');
  readonly detalle = input('');
  readonly activo = input(true);
}
