import { ChangeDetectionStrategy, Component, inject, model, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { CambiosDatos } from 'src/app/shared/crud/cambios-datos';
import { DatosRegistro, mensajeDeError } from 'src/app/shared/crud/crud';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { Acudiente } from '../acudiente';
import { AcudienteFormulario } from '../acudiente-formulario/acudiente-formulario';
import { AcudientesRepositorio } from '../acudientes-repositorio';

/**
 * Registro rápido de un acudiente en un modal encima del formulario actual (p. ej. el de un estudiante), para no
 * salir de la pantalla ni perder lo que ya se escribió. Usa el mismo formulario y reglas que Personas › Acudientes y
 * emite `creado` con el acudiente guardado.
 */
@Component({
  selector: 'app-alta-acudiente',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, AcudienteFormulario, AccionesFormulario],
  template: `
    <app-modal [(abierto)]="abierto" titulo="Nuevo acudiente" subtitulo="Queda registrado en Personas › Acudientes." ancho="max-w-4xl">
      @if (abierto()) {
        <app-acudiente-formulario idFormulario="form-alta-acudiente" modo="crear" (guardar)="guardar($event)" />
      }
      @if (abierto()) {
        <app-acciones-formulario pie formulario="form-alta-acudiente" modo="crear" [guardando]="guardando()"
          textoCrear="Registrar acudiente" (cancelar)="abierto.set(false)" />
      }
    </app-modal>
  `,
})
export class AltaAcudiente {
  readonly abierto = model(false);
  readonly creado = output<Acudiente>();

  private readonly repositorio = inject(AcudientesRepositorio);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly cambios = inject(CambiosDatos);
  protected readonly guardando = signal(false);

  protected async guardar(datos: DatosRegistro<Acudiente>): Promise<void> {
    this.guardando.set(true);
    try {
      const acudiente = await firstValueFrom(this.repositorio.crear(datos));
      this.notificaciones.exito('Acudiente registrado y seleccionado.');
      this.cambios.notificar();
      this.creado.emit(acudiente);
      this.abierto.set(false);
    } catch (error) {
      this.notificaciones.error(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}
