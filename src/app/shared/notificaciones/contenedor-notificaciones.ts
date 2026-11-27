import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { NotificacionesService, TipoNotificacion } from './notificaciones';

const ESTILOS: Record<TipoNotificacion, { clase: string; icono: string }> = {
  exito: { clase: 'alert-success', icono: 'fa-solid fa-circle-check' },
  error: { clase: 'alert-error', icono: 'fa-solid fa-circle-exclamation' },
  info: { clase: 'alert-info', icono: 'fa-solid fa-circle-info' },
};

/**
 * Toasts de la aplicación. Van en un popover (`popover="manual"`) para quedar en la CAPA SUPERIOR del navegador:
 * los modales (`<dialog>.showModal()`) también viven ahí y ningún z-index los supera. Cada vez que llega un aviso el
 * popover se vuelve a mostrar, así queda encima del último modal abierto.
 */
@Component({
  selector: 'app-notificaciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #capa popover="manual" class="capa-notificaciones toast toast-top toast-end z-[1000]" aria-live="polite">
      @for (notificacion of servicio.lista(); track notificacion.id) {
        @let estilo = estilos[notificacion.tipo];
        <div role="alert" class="alert shadow-lg text-sm max-w-sm" [class]="estilo.clase">
          <i [class]="estilo.icono"></i>
          <span>{{ notificacion.mensaje }}</span>
          <button type="button" class="btn btn-ghost btn-xs btn-circle" aria-label="Cerrar"
            (click)="servicio.cerrar(notificacion.id)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      }
    </div>
  `,
})
export class ContenedorNotificaciones {
  protected readonly servicio = inject(NotificacionesService);
  protected readonly estilos = ESTILOS;
  private readonly capa = viewChild.required<ElementRef<HTMLElement>>('capa');

  constructor() {
    effect(() => {
      const hay = this.servicio.lista().length > 0;
      const capa = this.capa().nativeElement;
      // jsdom y navegadores viejos no tienen la API de popover: ahí queda como un div fijo con z-index.
      if (typeof capa.showPopover !== 'function') return;
      try {
        if (capa.matches(':popover-open')) capa.hidePopover();
        if (hay) capa.showPopover();
      } catch {
        // Si el popover no se puede abrir, los avisos se siguen viendo con el z-index.
      }
    });
  }
}
