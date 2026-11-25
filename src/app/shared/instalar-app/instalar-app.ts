import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { InstalacionApp } from 'src/app/core/instalacion-app';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';

/**
 * Tarjeta "Instala RutaRola en este equipo" (aplicación web instalable, PWA). En Chrome/Edge/Android muestra el botón del
 * navegador; en iPhone/iPad y Safari de Mac, los pasos. No se muestra en la app de Android ni si ya está instalada.
 */
@Component({
  selector: 'app-instalar-app',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (instalacion.puedeOfrecer()) {
      <div class="rounded-box border border-base-300 bg-base-200 p-4 flex flex-col gap-3" [class.shadow-xl]="destacada()">
        <div class="flex items-start gap-3">
          <img src="iconos/icono-192.png" alt="" class="size-11 rounded-xl shrink-0" />
          <div class="min-w-0">
            <p class="font-semibold">Instala RutaRola en este equipo</p>
            <p class="text-sm text-base-content/70">
              Ábrela desde un ícono en tu escritorio o pantalla de inicio, en su propia ventana, como cualquier aplicación.
            </p>
          </div>
        </div>
        @switch (instalacion.forma()) {
          @case ('NATIVO') {
            <button type="button" class="btn bg-base-300 border-neutral hover:bg-neutral self-start" (click)="instalar()">
              <i class="fa-solid fa-download text-info" aria-hidden="true"></i> Instalar RutaRola
            </button>
          }
          @case ('IOS') {
            <ol class="text-sm text-base-content/80 list-decimal pl-5 space-y-1">
              <li>Abre esta página en <strong>Safari</strong>.</li>
              <li>Toca el botón <strong>Compartir</strong> <i class="fa-solid fa-arrow-up-from-bracket text-info" aria-label="Compartir"></i>.</li>
              <li>Elige <strong>"Agregar a inicio"</strong> y confirma con <strong>Agregar</strong>.</li>
            </ol>
          }
          @case ('SAFARI_MAC') {
            <ol class="text-sm text-base-content/80 list-decimal pl-5 space-y-1">
              <li>En la barra de menú de Safari, abre <strong>Archivo</strong>.</li>
              <li>Elige <strong>"Agregar al Dock…"</strong> y confirma con <strong>Agregar</strong>.</li>
            </ol>
          }
        }
      </div>
    }
  `,
})
export class InstalarApp {
  /** Con sombra cuando va sola (login). */
  readonly destacada = input(false);
  protected readonly instalacion = inject(InstalacionApp);
  private readonly notificaciones = inject(NotificacionesService);

  protected async instalar(): Promise<void> {
    if (await this.instalacion.instalar()) this.notificaciones.exito('RutaRola quedó instalada. Ábrela desde su ícono.');
  }
}
