import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, model } from '@angular/core';
import { Modal } from 'src/app/shared/modal/modal';
import { AjustesTelefono, ajusteDeMarca } from '../ajustes-telefono';

/**
 * Guía "Prepara tu teléfono" (app instalada): se muestra la primera vez que el conductor o la monitora tienen un
 * recorrido en curso, y cuando quieran desde la línea de ubicación. Cada paso muestra ✓ si ya está hecho (se vuelve a
 * leer al regresar de los ajustes) y un botón que abre el ajuste exacto.
 */
@Component({
  selector: 'app-preparar-telefono',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, NgTemplateOutlet],
  template: `
    <app-modal [(abierto)]="abierto" titulo="Prepara tu teléfono" subtitulo="Para que la ubicación no se pause durante el recorrido" ancho="max-w-lg">
      @if (abierto()) {
        <div class="flex flex-col gap-4 text-sm">
          <p class="text-base-content/80">
            Así el colegio y las familias ven la ruta aunque uses WhatsApp, llames o bloquees la pantalla. Solo hay que hacerlo
            una vez en este teléfono.
          </p>
          <ol class="flex flex-col gap-3">
            <li class="rounded-box border border-base-300 p-3 flex flex-col gap-2">
              <div class="flex items-start gap-3">
                <ng-container *ngTemplateOutlet="marca; context: { $implicit: estado()?.notificaciones }" />
                <div class="flex-1">
                  <p class="font-medium">1. Permite las notificaciones</p>
                  <p class="text-base-content/70">Mientras compartes, verás el aviso "RutaRola está compartiendo la ubicación".</p>
                </div>
              </div>
              @if (estado() && !estado()!.notificaciones) {
                <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral self-start" (click)="ajustes.solicitarNotificaciones()">
                  <i class="fa-solid fa-bell text-info" aria-hidden="true"></i> Permitir notificaciones
                </button>
              }
            </li>

            <li class="rounded-box border border-base-300 p-3 flex flex-col gap-2">
              <div class="flex items-start gap-3">
                <ng-container *ngTemplateOutlet="marca; context: { $implicit: estado()?.sinOptimizacionBateria }" />
                <div class="flex-1">
                  <p class="font-medium">2. Quita a RutaRola del ahorro de batería</p>
                  <p class="text-base-content/70">
                    Toca el botón, busca <strong>RutaRola</strong> en la lista (si no aparece, elige "Todas las aplicaciones") y
                    marca <strong>"No optimizar"</strong> o <strong>"Sin restricciones"</strong>. Luego vuelve aquí.
                  </p>
                </div>
              </div>
              @if (estado() && !estado()!.sinOptimizacionBateria) {
                <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral self-start" (click)="ajustes.abrirOptimizacionBateria()">
                  <i class="fa-solid fa-battery-full text-info" aria-hidden="true"></i> Abrir ajustes de batería
                </button>
              }
            </li>

            @if (deMarca(); as m) {
              <li class="rounded-box border border-base-300 p-3 flex flex-col gap-2">
                <div class="flex items-start gap-3">
                  <i class="fa-solid fa-mobile-screen-button text-warning text-lg w-6 text-center mt-0.5" aria-hidden="true"></i>
                  <div class="flex-1">
                    <p class="font-medium">3. Ajuste de tu {{ m.marca }}</p>
                    <p class="text-base-content/70">{{ m.pasos }}</p>
                  </div>
                </div>
                <button type="button" class="btn btn-sm bg-base-300 border-neutral hover:bg-neutral self-start" (click)="ajustes.abrirAjustesApp()">
                  <i class="fa-solid fa-gear text-info" aria-hidden="true"></i> Abrir información de RutaRola
                </button>
              </li>
            }

            <li class="rounded-box border border-base-300 p-3 flex items-start gap-3">
              <i class="fa-solid fa-location-dot text-info text-lg w-6 text-center mt-0.5" aria-hidden="true"></i>
              <div class="flex-1">
                <p class="font-medium">{{ deMarca() ? 4 : 3 }}. Permite la ubicación</p>
                <p class="text-base-content/70">
                  Cuando el teléfono pregunte, elige <strong>"Mientras se usa la app"</strong> y deja activada la
                  <strong>ubicación precisa</strong>. No hace falta "Permitir todo el tiempo".
                </p>
              </div>
            </li>
          </ol>
        </div>
      }
      @if (abierto()) {
        <div pie class="flex flex-wrap justify-end gap-2 w-full">
          <button type="button" class="btn btn-primary" (click)="abierto.set(false)">
            {{ listo() ? 'Listo' : 'Continuar así' }}
          </button>
        </div>
      }
    </app-modal>

    <ng-template #marca let-hecho>
      @if (hecho) {
        <i class="fa-solid fa-circle-check text-success text-lg w-6 text-center mt-0.5" aria-label="Hecho"></i>
      } @else {
        <i class="fa-regular fa-circle text-warning text-lg w-6 text-center mt-0.5" aria-label="Pendiente"></i>
      }
    </ng-template>
  `,
})
export class PrepararTelefono {
  readonly abierto = model(false);
  protected readonly ajustes = inject(AjustesTelefono);
  protected readonly estado = this.ajustes.estado;
  protected readonly deMarca = computed(() => ajusteDeMarca(this.estado()?.fabricante ?? ''));
  protected readonly listo = computed(() => !!this.estado()?.notificaciones && !!this.estado()?.sinOptimizacionBateria);

  constructor() {
    // Al volver de los ajustes del sistema se vuelve a leer el estado para marcar ✓.
    const alVolver = () => {
      if (document.visibilityState === 'visible' && this.abierto()) void this.ajustes.actualizar();
    };
    document.addEventListener('visibilitychange', alVolver);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', alVolver));
    // Se da por vista al cerrarla (no al crearse cerrada).
    let fueAbierta = false;
    effect(() => {
      if (this.abierto()) {
        fueAbierta = true;
        void this.ajustes.actualizar();
      } else if (fueAbierta) {
        this.ajustes.marcarGuiaVista();
      }
    });
  }
}
