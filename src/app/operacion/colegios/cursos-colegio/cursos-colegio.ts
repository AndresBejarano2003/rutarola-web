import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { GRADOS, JORNADAS, aMapa } from 'src/app/shared/catalogos/catalogos';
import { ESTADOS_REGISTRO, EstadoRegistro } from 'src/app/shared/crud/crud';
import { horaLegible } from 'src/app/shared/fechas/fechas';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { Curso, GRADO_INICIAL, JORNADA_INICIAL, claveCurso, generarCursos, ordenarCursos } from '../colegio';

/** UN curso suelto o VARIOS (de un grado inicial a uno final). */
type ModoAgregar = 'UNO' | 'VARIOS';

/**
 * Parametrización de cursos de un colegio (valor: `Curso[]`).
 *
 * Cada curso es un grado en una jornada con su horario (el mismo grado puede
 * estar en Mañana y Tarde). "Agregar" ofrece un curso suelto o un rango de
 * grados (por defecto desde Jardín) con el mismo horario. Cada curso se puede
 * modificar (horario y estado) o quitar. Deshabilitado (consulta) solo
 * muestra la tabla.
 */
@Component({
  selector: 'app-cursos-colegio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectorBusqueda, BadgeEstado],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CursosColegio), multi: true }],
  host: { class: 'block md:col-span-2' },
  templateUrl: './cursos-colegio.html',
})
export class CursosColegio implements ControlValueAccessor {
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly grados = GRADOS;
  protected readonly nombresGrado = aMapa(GRADOS);
  protected readonly jornadas = JORNADAS;
  protected readonly estados = ESTADOS_REGISTRO;
  protected readonly claveCurso = claveCurso;
  protected readonly horaLegible = horaLegible;

  protected readonly cursos = signal<Curso[]>([]);
  protected readonly deshabilitado = signal(false);
  protected readonly modoAgregar = signal<ModoAgregar>('VARIOS');
  /** Clave (grado|jornada) del curso que se está modificando. */
  protected readonly editando = signal<string | null>(null);
  protected readonly errorGenerador = signal<string | null>(null);
  protected readonly errorEdicion = signal<string | null>(null);
  protected readonly activos = computed(() => this.cursos().filter((c) => c.estado === 'ACTIVO').length);
  protected readonly variasJornadas = computed(() => new Set(this.cursos().map((c) => c.jornada)).size > 1);

  protected readonly generador = this.fb.group({
    desde: [GRADO_INICIAL],
    hasta: ['', Validators.required],
    jornada: [JORNADA_INICIAL, Validators.required],
    horaEntrada: ['06:30', Validators.required],
    horaSalida: ['13:00', Validators.required],
  });

  protected readonly edicion = this.fb.group({
    horaEntrada: ['', Validators.required],
    horaSalida: ['', Validators.required],
    estado: this.fb.control<EstadoRegistro>('ACTIVO'),
  });

  private alCambiar: (valor: Curso[]) => void = () => {};
  private alTocar: () => void = () => {};

  writeValue(valor: Curso[] | null): void {
    this.cursos.set(ordenarCursos(valor ?? []));
    this.editando.set(null);
  }
  registerOnChange(fn: (valor: Curso[]) => void): void {
    this.alCambiar = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }
  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
    this.editando.set(null);
  }

  protected cambiarModo(modo: ModoAgregar): void {
    this.modoAgregar.set(modo);
    this.errorGenerador.set(null);
  }

  protected agregarCursos(): void {
    const { desde, hasta, jornada, horaEntrada, horaSalida } = this.generador.getRawValue();
    const uno = this.modoAgregar() === 'UNO';
    if (!hasta || !jornada || !horaEntrada || !horaSalida || (!uno && !desde)) {
      this.generador.markAllAsTouched();
      this.errorGenerador.set(uno ? 'Elige el curso, la jornada y el horario.' : 'Elige los cursos, la jornada y el horario.');
      return;
    }
    if (horaSalida <= horaEntrada) {
      this.errorGenerador.set('La hora de salida debe ser posterior a la de entrada.');
      return;
    }
    this.errorGenerador.set(null);
    this.actualizar(generarCursos(this.cursos(), hasta, horaEntrada, horaSalida, jornada, uno ? hasta : desde));
  }

  protected modificar(curso: Curso): void {
    this.errorEdicion.set(null);
    this.edicion.reset({ horaEntrada: curso.horaEntrada, horaSalida: curso.horaSalida, estado: curso.estado });
    this.editando.set(claveCurso(curso));
  }

  protected guardarEdicion(): void {
    const { horaEntrada, horaSalida, estado } = this.edicion.getRawValue();
    if (!horaEntrada || !horaSalida || horaSalida <= horaEntrada) {
      this.errorEdicion.set('La hora de salida debe ser posterior a la de entrada.');
      return;
    }
    const clave = this.editando();
    this.actualizar(this.cursos().map((c) => (claveCurso(c) === clave ? { ...c, horaEntrada, horaSalida, estado } : c)));
    this.editando.set(null);
  }

  protected quitar(curso: Curso): void {
    const clave = claveCurso(curso);
    this.actualizar(this.cursos().filter((c) => claveCurso(c) !== clave));
  }

  private actualizar(cursos: Curso[]): void {
    this.cursos.set(ordenarCursos(cursos));
    this.alCambiar(cursos);
    this.alTocar();
  }
}
