import { ChangeDetectionStrategy, Component, booleanAttribute, computed, effect, inject, input, output, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, pairwise, startWith } from 'rxjs';
import { Curso } from 'src/app/operacion/colegios/colegio';
import { horaLegible } from 'src/app/shared/fechas/fechas';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogosService, OpcionCatalogo, aMapa, ordenGrado } from 'src/app/shared/catalogos/catalogos';
import { DatosRegistro, ESTADOS_REGISTRO, EstadoRegistro, ModoFormulario } from 'src/app/shared/crud/crud';
import { fechaNoFutura, mensajeError } from 'src/app/shared/formularios/formularios';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { CamposPersona } from '../../compartido/campos-persona/campos-persona';
import { controlesPersona, limpiarPersona } from '../../compartido/persona';
import { Estudiante } from '../estudiante';

/**
 * Campos para crear, editar o consultar (solo lectura) un estudiante.
 * Los botones NO van aquí: van en el pie fijo del modal (`app-acciones-formulario`).
 */
@Component({
  selector: 'app-estudiante-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectorBusqueda, CamposPersona],
  templateUrl: './estudiante-formulario.html',
})
export class EstudianteFormulario {
  /** `id` del `<form>`; el botón Guardar del pie del modal lo usa con `form="..."`. */
  readonly idFormulario = input.required<string>();
  readonly estudiante = input<Estudiante | null>(null);
  readonly modo = input.required<ModoFormulario>();
  /** Opciones del módulo de acudientes. */
  readonly acudientes = input<OpcionCatalogo[]>([]);
  /** Opciones del módulo de colegios. */
  readonly colegios = input<OpcionCatalogo[]>([]);
  /** Cursos del colegio elegido (`null` = aún no cargan: se ofrecen todos los grados). */
  readonly cursos = input<Curso[] | null>(null);

  /** Acudiente elegido al crear (p. ej. desde el detalle de un acudiente). */
  readonly acudienteInicial = input('');
  /** El acudiente no se puede cambiar (alta desde el acudiente) y no se ofrece crear otro. */
  readonly acudienteFijo = input(false, { transform: booleanAttribute });

  readonly guardar = output<DatosRegistro<Estudiante>>();
  /** "Nuevo acudiente": la página abre el registro rápido encima, sin perder lo escrito. */
  readonly nuevoAcudiente = output<void>();
  /** Cambió el colegio: la página carga sus cursos. */
  readonly colegioCambiado = output<string>();

  protected readonly catalogos = inject(CatalogosService);
  protected readonly estados = ESTADOS_REGISTRO;
  protected readonly hoy = new Date().toISOString().slice(0, 10);
  protected readonly soloLectura = computed(() => this.modo() === 'consultar');
  protected readonly ultimaActualizacion = computed(() => {
    const fecha = this.estudiante()?.fechaActualizacion;
    return fecha ? new Date(fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : null;
  });

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    ...controlesPersona(this.fb),
    fechaNacimiento: ['', [Validators.required, fechaNoFutura]],
    direccion: ['', [Validators.required, Validators.maxLength(120)]],
    acudienteId: ['', Validators.required],
    colegioId: ['', Validators.required],
    grado: ['', Validators.required],
    jornada: ['', Validators.required],
    estado: this.fb.control<EstadoRegistro>('ACTIVO', Validators.required),
    observaciones: ['', Validators.maxLength(500)],
  });

  private readonly gradoActual = toSignal(this.form.controls.grado.valueChanges, { initialValue: '' });
  protected readonly jornadaActual = toSignal(this.form.controls.jornada.valueChanges, { initialValue: '' });
  private readonly cursosActivos = computed(() => this.cursos()?.filter((c) => c.estado === 'ACTIVO') ?? []);

  /** Jornadas en las que el colegio tiene cursos activos (todas si no tiene cursos). Conserva la guardada. */
  protected readonly jornadas = computed<OpcionCatalogo[]>(() => {
    const ofrecidas = new Set(this.cursosActivos().map((c) => c.jornada));
    const actual = this.jornadaActual() || this.form.controls.jornada.value;
    const lista = ofrecidas.size ? this.catalogos.jornadas.filter((j) => ofrecidas.has(j.id) || j.id === actual) : this.catalogos.jornadas;
    return lista;
  });

  /** El colegio tiene cursos, pero ninguno activo en la jornada elegida. */
  protected readonly sinCursosEnJornada = computed(() => {
    const jornada = this.jornadaActual();
    return !!jornada && this.cursosActivos().length > 0 && !this.cursosActivos().some((c) => c.jornada === jornada);
  });

  /**
   * Grados que ofrece el colegio en la jornada elegida (cursos activos con su horario). Sin jornada se muestran los de
   * todas; si el colegio no tiene cursos, todos los grados.
   */
  protected readonly grados = computed<OpcionCatalogo[]>(() => {
    const activos = this.cursosActivos();
    if (!activos.length) {
      return this.catalogos.grados;
    }
    const jornada = this.jornadaActual();
    const cursos = jornada ? activos.filter((c) => c.jornada === jornada) : activos;
    const nombres = aMapa(this.catalogos.grados);
    const vistos = new Set<string>();
    const opciones = [...cursos]
      .sort((a, b) => ordenGrado(a.grado) - ordenGrado(b.grado))
      .filter((c) => !vistos.has(c.grado) && !!vistos.add(c.grado))
      .map((c) => ({
        id: c.grado,
        nombre: jornada
          ? `${nombres.get(c.grado) ?? c.grado} (${horaLegible(c.horaEntrada)} – ${horaLegible(c.horaSalida)})`
          : (nombres.get(c.grado) ?? c.grado),
      }));
    // Conserva el grado guardado aunque el colegio ya no lo ofrezca.
    const actual = this.gradoActual() || this.form.controls.grado.value;
    return actual && !opciones.some((o) => o.id === actual) ? [{ id: actual, nombre: actual }, ...opciones] : opciones;
  });

  /** `true` mientras se carga un registro (sus valores no cuentan como cambios del usuario). */
  private cargando = false;

  constructor() {
    this.form.controls.colegioId.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((colegioId) => this.colegioCambiado.emit(colegioId));

    // Los grados dependen de la jornada: si el usuario la cambia, el grado queda vacío y debe elegir uno de la nueva.
    this.form.controls.jornada.valueChanges.pipe(startWith(this.form.controls.jornada.value), pairwise(), takeUntilDestroyed()).subscribe(([antes, ahora]) => {
      // Al cargar un registro, o al elegir la primera jornada de uno nuevo, el grado se respeta.
      if (this.cargando || !antes || antes === ahora) return;
      const grado = this.form.controls.grado;
      if (!grado.value) return;
      grado.setValue('');
      grado.markAsTouched();
      grado.markAsDirty();
    });

    // Carga el registro recibido y bloquea el formulario en modo consulta.
    effect(() => {
      const estudiante = this.estudiante();
      this.cargando = true;
      if (estudiante) {
        const { id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = estudiante;
        this.form.reset(datos);
      } else {
        this.form.reset({ acudienteId: untracked(this.acudienteInicial) });
      }
      this.cargando = false;
      if (this.soloLectura()) {
        this.form.disable();
      } else {
        this.form.enable();
        if (untracked(this.acudienteFijo)) this.form.controls.acudienteId.disable();
      }
    });
  }

  /** Selecciona el acudiente recién creado en el registro rápido. */
  elegirAcudiente(id: string): void {
    this.form.controls.acudienteId.setValue(id);
    this.form.controls.acudienteId.markAsDirty();
  }

  protected error(campo: keyof typeof this.form.controls): string | null {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = limpiarPersona(this.form.getRawValue());
    this.guardar.emit({
      ...valores,
      direccion: valores.direccion.trim(),
      observaciones: valores.observaciones.trim(),
    });
  }
}
