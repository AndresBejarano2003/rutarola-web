import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { distinctUntilChanged } from 'rxjs';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { CatalogosService, OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { DatosRegistro, ESTADOS_REGISTRO, EstadoRegistro, ModoFormulario } from 'src/app/shared/crud/crud';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { ListaSeleccion } from 'src/app/shared/lista-seleccion/lista-seleccion';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { Ruta } from '../ruta';

/**
 * Campos de la ruta y sus estudiantes. Al cambiar el colegio emite
 * `colegioCambiado` para que la página cargue los estudiantes de ese colegio.
 */
@Component({
  selector: 'app-ruta-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectorBusqueda, Campo, TituloSeccion, ListaSeleccion],
  templateUrl: './ruta-formulario.html',
})
export class RutaFormulario {
  readonly idFormulario = input.required<string>();
  readonly ruta = input<Ruta | null>(null);
  readonly modo = input.required<ModoFormulario>();
  readonly colegios = input<OpcionCatalogo[]>([]);
  /** Estudiantes del colegio y la jornada elegidos (los que se pueden agregar). */
  readonly estudiantes = input<OpcionCatalogo[]>([]);
  /** Todos los estudiantes del colegio: dan el nombre a los que ya iban en la ruta aunque sean de otra jornada. */
  readonly estudiantesColegio = input<OpcionCatalogo[]>([]);

  readonly guardar = output<DatosRegistro<Ruta>>();
  /** Cambió el colegio o la jornada: la página carga los estudiantes que se pueden agregar. */
  readonly filtroEstudiantesCambiado = output<{ colegioId: string; jornada: string }>();

  protected readonly catalogos = inject(CatalogosService);
  protected readonly estados = ESTADOS_REGISTRO;
  protected readonly soloLectura = computed(() => this.modo() === 'consultar');

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    // Lo asigna el sistema al crear; se muestra solo para consultar.
    codigo: [''],
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    colegioId: ['', Validators.required],
    jornada: ['', Validators.required],
    sector: ['', [Validators.required, Validators.maxLength(200)]],
    estudianteIds: this.fb.control<string[]>([]),
    estado: this.fb.control<EstadoRegistro>('ACTIVO', Validators.required),
    observaciones: ['', Validators.maxLength(500)],
  });

  private reiniciando = false;
  private readonly elegidos = toSignal(this.form.controls.estudianteIds.valueChanges, { initialValue: [] as string[] });

  /**
   * Opciones de la lista: los de la jornada de la ruta + los que ya iban en ella (de otra jornada, por datos
   * anteriores), para que se vean con su nombre y se puedan quitar.
   */
  protected readonly opcionesEstudiantes = computed<OpcionCatalogo[]>(() => {
    const disponibles = this.estudiantes();
    const ids = new Set(disponibles.map((o) => o.id));
    const elegidos = new Set(this.elegidos());
    const previos = this.estudiantesColegio().filter((o) => elegidos.has(o.id) && !ids.has(o.id));
    return [...disponibles, ...previos.map((o) => ({ ...o, nombre: `${o.nombre} (otra jornada)` }))];
  });

  constructor() {
    const { colegioId, jornada } = this.form.controls;
    colegioId.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        // Si el usuario cambia de colegio, los estudiantes elegidos (de otro colegio) se quitan.
        if (!this.reiniciando) {
          this.form.controls.estudianteIds.setValue([]);
        }
        this.emitirFiltro();
      });
    jornada.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        // Solo van estudiantes de la jornada de la ruta: al cambiarla se quitan los elegidos.
        if (!this.reiniciando && this.form.controls.estudianteIds.value.length) {
          this.form.controls.estudianteIds.setValue([]);
        }
        this.emitirFiltro();
      });

    effect(() => {
      const ruta = this.ruta();
      this.reiniciando = true;
      if (ruta) {
        const { id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = ruta;
        this.form.reset(datos);
      } else {
        this.form.reset();
      }
      this.reiniciando = false;
      if (this.soloLectura()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
  }

  private emitirFiltro(): void {
    const { colegioId, jornada } = this.form.getRawValue();
    this.filtroEstudiantesCambiado.emit({ colegioId, jornada });
  }

  protected error(campo: keyof typeof this.form.controls): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardar.emit({
      ...v,
      codigo: this.ruta()?.codigo ?? '',
      nombre: v.nombre.trim(),
      sector: v.sector.trim(),
      observaciones: v.observaciones.trim(),
    });
  }
}
