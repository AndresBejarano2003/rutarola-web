import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, map, of, switchMap } from 'rxjs';
import { Curso } from 'src/app/operacion/colegios/colegio';
import { ColegiosRepositorio } from 'src/app/operacion/colegios/colegios-repositorio';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { CambiosDatos } from 'src/app/shared/crud/cambios-datos';
import { DatosRegistro, mensajeDeError } from 'src/app/shared/crud/crud';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { AcudientesRepositorio } from '../../acudientes/acudientes-repositorio';
import { Estudiante } from '../estudiante';
import { EstudianteFormulario } from '../estudiante-formulario/estudiante-formulario';
import { EstudiantesRepositorio } from '../estudiantes-repositorio';

/**
 * Registro rápido de un estudiante en un modal encima de la pantalla actual (p. ej. el detalle de un acudiente), con
 * el acudiente ya elegido y fijo. Mismo formulario y reglas que Personas › Estudiantes; emite `creado`.
 */
@Component({
  selector: 'app-alta-estudiante',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, EstudianteFormulario, AccionesFormulario],
  template: `
    <app-modal [(abierto)]="abierto" titulo="Nuevo estudiante" [subtitulo]="subtitulo()" ancho="max-w-4xl">
      @if (abierto()) {
        <app-estudiante-formulario idFormulario="form-alta-estudiante" modo="crear" [acudientes]="acudientes()"
          [colegios]="colegios()" [cursos]="cursos()" [acudienteInicial]="acudienteId()" acudienteFijo
          (colegioCambiado)="colegio.set($event)" (guardar)="guardar($event)" />
      }
      @if (abierto()) {
        <app-acciones-formulario pie formulario="form-alta-estudiante" modo="crear" [guardando]="guardando()"
          textoCrear="Registrar estudiante" (cancelar)="abierto.set(false)" />
      }
    </app-modal>
  `,
})
export class AltaEstudiante {
  readonly abierto = model(false);
  /** Acudiente al que queda a cargo el estudiante. */
  readonly acudienteId = input.required<string>();
  /** Nombre del acudiente para el subtítulo. */
  readonly nombreAcudiente = input('');
  readonly creado = output<Estudiante>();

  private readonly repositorio = inject(EstudiantesRepositorio);
  private readonly colegiosRepo = inject(ColegiosRepositorio);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly cambios = inject(CambiosDatos);
  protected readonly guardando = signal(false);
  protected readonly subtitulo = computed(() => (this.nombreAcudiente() ? `A cargo de ${this.nombreAcudiente()}` : ''));

  protected readonly acudientes = toSignal(inject(AcudientesRepositorio).opciones().pipe(catchError(() => of<OpcionCatalogo[]>([]))), {
    initialValue: [],
  });
  protected readonly colegios = toSignal(this.colegiosRepo.opciones().pipe(catchError(() => of<OpcionCatalogo[]>([]))), {
    initialValue: [],
  });
  protected readonly colegio = signal('');
  protected readonly cursos = toSignal(
    toObservable(this.colegio).pipe(
      switchMap((id) =>
        id
          ? this.colegiosRepo.obtener(id).pipe(
              map((c): Curso[] | null => c.cursos),
              catchError(() => of(null)),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected async guardar(datos: DatosRegistro<Estudiante>): Promise<void> {
    this.guardando.set(true);
    try {
      const estudiante = await firstValueFrom(this.repositorio.crear({ ...datos, acudienteId: this.acudienteId() }));
      this.notificaciones.exito('Estudiante registrado.');
      this.cambios.notificar();
      this.creado.emit(estudiante);
      this.abierto.set(false);
    } catch (error) {
      this.notificaciones.error(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}
