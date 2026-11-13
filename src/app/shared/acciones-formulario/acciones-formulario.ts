import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ModoFormulario } from '../crud/crud';

/**
 * Botones estándar del pie de un modal de formulario. Se proyecta en el pie
 * fijo de `<app-modal>` con el atributo `pie`, y envía el formulario con el
 * atributo HTML `form` (no necesita estar dentro del `<form>`):
 *
 * ```html
 * <app-acciones-formulario pie formulario="form-x" [modo]="modo()" [guardando]="store.guardando()"
 *   textoCrear="Registrar x" (cancelar)="cerrar()" (editar)="modo.set('editar')" />
 * ```
 */
@Component({
  selector: 'app-acciones-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap items-center justify-end gap-2' },
  template: `
    <!-- Acciones extra del registro (p. ej. "Descargar PDF"), a la izquierda de Cerrar. -->
    <ng-content />
    <button type="button" class="btn btn-ghost" [disabled]="guardando()" (click)="cancelar.emit()">
      {{ soloLectura() ? 'Cerrar' : 'Cancelar' }}
    </button>
    @if (soloLectura()) {
      <button type="button" class="btn btn-primary" (click)="editar.emit()">
        <i class="fa-solid fa-pen"></i>
        Editar
      </button>
    } @else {
      <button type="submit" class="btn btn-primary" [attr.form]="formulario()" [disabled]="guardando() || bloqueado()">
        @if (guardando()) {
          <span class="loading loading-spinner loading-sm"></span>
          Guardando...
        } @else {
          <i class="fa-solid fa-floppy-disk"></i>
          {{ modo() === 'crear' ? textoCrear() : textoEditar() }}
        }
      </button>
    }
  `,
})
export class AccionesFormulario {
  /** `id` del `<form>` que envía el botón Guardar. */
  readonly formulario = input.required<string>();
  readonly modo = input.required<ModoFormulario>();
  readonly guardando = input(false);
  /** Deshabilita Guardar (p. ej. mientras se carga el registro). */
  readonly bloqueado = input(false);
  readonly textoCrear = input('Registrar');
  readonly textoEditar = input('Guardar cambios');

  readonly cancelar = output<void>();
  /** Desde "consultar", pasar a "editar". */
  readonly editar = output<void>();

  protected readonly soloLectura = computed(() => this.modo() === 'consultar');
}
