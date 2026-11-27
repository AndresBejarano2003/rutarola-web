import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { distinctUntilChanged } from 'rxjs';
import { Campo, TituloSeccion } from 'src/app/shared/campo/campo';
import { CatalogosService, OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { DatosRegistro, ESTADOS_REGISTRO, EstadoRegistro, ModoFormulario } from 'src/app/shared/crud/crud';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { moverEnLista } from 'src/app/ruta-del-dia/recorrido';
import { Ruta } from '../ruta';

/** Estudiantes de un colegio: los de la jornada de la ruta (se pueden agregar) y todos (dan el nombre a los que ya iban). */
export interface EstudiantesColegio {
  jornada: OpcionCatalogo[];
  todos: OpcionCatalogo[];
}

/** Lo que la página debe cargar: los colegios de la jornada y los estudiantes de cada colegio elegido. */
export interface ColegiosRuta {
  jornada: string;
  colegioIds: string[];
}

/** Un colegio de la ruta con sus estudiantes en el orden de recogida. */
interface BloqueColegio {
  colegioId: string;
  nombre: string;
  estudiantes: OpcionCatalogo[];
  /** Estudiantes del colegio en la jornada que no están en la ruta (para volver a agregarlos). */
  disponibles: OpcionCatalogo[];
  cargando: boolean;
  /** Por qué no hay estudiantes precargados: el colegio no tiene en la jornada, o todos van en otras rutas. */
  motivoVacio: string;
}

/**
 * Campos de la ruta, sus colegios y sus estudiantes:
 * 1. se elige la jornada; 2. se agrega un colegio de esa jornada y se precargan TODOS sus estudiantes de la jornada
 * (menos los que ya van en otra ruta activa), de los que se quitan uno o varios; 3. se agrega el siguiente colegio
 * (los elegidos ya no aparecen), y así. Al final, el orden de recogida de todos (subir/bajar): es el orden con el que
 * arranca cada recorrido. Emite `colegiosCambiados` para que la página cargue los datos.
 */
@Component({
  selector: 'app-ruta-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, SelectorBusqueda, Campo, TituloSeccion],
  templateUrl: './ruta-formulario.html',
})
export class RutaFormulario {
  readonly idFormulario = input.required<string>();
  readonly ruta = input<Ruta | null>(null);
  readonly modo = input.required<ModoFormulario>();
  /** Todos los colegios (nombres). */
  readonly colegios = input<OpcionCatalogo[]>([]);
  /** Colegios con cursos activos en la jornada elegida (los que se pueden agregar). */
  readonly colegiosJornada = input<OpcionCatalogo[]>([]);
  /** Estudiantes de cada colegio elegido (`colegioId →`); un colegio sin entrada aún se está cargando. */
  readonly estudiantesColegios = input<ReadonlyMap<string, EstudiantesColegio>>(new Map());
  /** Estudiantes que ya van en OTRA ruta activa de la jornada (`estudianteId → "R-02 · Centro"`): no se precargan. */
  readonly ocupados = input<ReadonlyMap<string, string>>(new Map());

  readonly guardar = output<DatosRegistro<Ruta>>();
  readonly colegiosCambiados = output<ColegiosRuta>();
  /** Se va a agregar este colegio: la página vuelve a consultar sus estudiantes (pudieron cambiar desde la última vez). */
  readonly colegioAgregado = output<string>();

  protected readonly catalogos = inject(CatalogosService);
  protected readonly estados = ESTADOS_REGISTRO;
  protected readonly soloLectura = computed(() => this.modo() === 'consultar');

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    // Lo asigna el sistema al crear; se muestra solo para consultar.
    codigo: [''],
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    jornada: ['', Validators.required],
    sector: ['', [Validators.required, Validators.maxLength(200)]],
    colegioIds: this.fb.control<string[]>([], (c) => ((c.value as string[]).length ? null : { required: true })),
    estudianteIds: this.fb.control<string[]>([]),
    estado: this.fb.control<EstadoRegistro>('ACTIVO', Validators.required),
    observaciones: ['', Validators.maxLength(500)],
  });

  protected readonly jornada = signal('');
  protected readonly colegioIds = signal<string[]>([]);
  protected readonly estudianteIds = signal<string[]>([]);
  /** Colegio elegido en el selector "Agregar colegio". */
  protected readonly colegioPorAgregar = signal('');
  /** Colegios recién agregados cuyos estudiantes se precargan cuando lleguen. */
  private readonly porPrecargar = signal<string[]>([]);
  /** Casillas marcadas para "Quitar seleccionados". */
  protected readonly marcados = signal<ReadonlySet<string>>(new Set());
  /** Mensaje para lectores de pantalla tras mover un estudiante. */
  protected readonly anuncio = signal('');

  private reiniciando = false;

  private readonly nombreColegio = computed(() => new Map(this.colegios().map((c) => [c.id, c.nombre])));

  /** Colegio de cada estudiante conocido (por los estudiantes cargados de cada colegio). */
  private readonly colegioDe = computed(() => {
    const mapa = new Map<string, string>();
    for (const [colegioId, e] of this.estudiantesColegios()) {
      for (const o of [...e.todos, ...e.jornada]) mapa.set(o.id, colegioId);
    }
    return mapa;
  });

  private readonly nombreEstudiante = computed(() => {
    const mapa = new Map<string, string>();
    for (const e of this.estudiantesColegios().values()) {
      for (const o of e.todos) mapa.set(o.id, o.nombre);
      for (const o of e.jornada) mapa.set(o.id, o.nombre);
    }
    return mapa;
  });

  /** Ids de la jornada de cada colegio (para marcar "otra jornada" a los que ya iban). */
  private readonly deLaJornada = computed(() => new Set([...this.estudiantesColegios().values()].flatMap((e) => e.jornada.map((o) => o.id))));

  /** Colegios de la jornada que aún no están en la ruta. */
  protected readonly colegiosDisponibles = computed(() => this.colegiosJornada().filter((c) => !this.colegioIds().includes(c.id)));

  protected readonly bloques = computed((): BloqueColegio[] => {
    const elegidos = this.estudianteIds();
    const colegioDe = this.colegioDe();
    const ocupados = this.ocupados();
    return this.colegioIds().map((colegioId) => {
      const datos = this.estudiantesColegios().get(colegioId);
      return {
        colegioId,
        nombre: this.nombreColegio().get(colegioId) ?? 'Colegio',
        estudiantes: elegidos.filter((id) => colegioDe.get(id) === colegioId).map((id) => this.opcion(id)),
        disponibles: (datos?.jornada ?? [])
          .filter((o) => !elegidos.includes(o.id))
          .map((o) => (ocupados.has(o.id) ? { ...o, nombre: `${o.nombre} (va en ${ocupados.get(o.id)})` } : o)),
        cargando: !datos,
        motivoVacio: this.motivoVacio(datos?.jornada ?? [], ocupados),
      };
    });
  });

  /** Todos los estudiantes en el orden de recogida, con su colegio. */
  protected readonly orden = computed(() => {
    const colegioDe = this.colegioDe();
    return this.estudianteIds().map((id) => {
      const colegioId = colegioDe.get(id) ?? '';
      return { ...this.opcion(id), colegioId, colegio: colegioId ? (this.nombreColegio().get(colegioId) ?? '') : '' };
    });
  });

  /** Estudiantes cuyo colegio no está en la ruta (datos anteriores o el estudiante cambió de colegio). */
  protected readonly sinColegio = computed(() => {
    const cargando = this.colegioIds().some((id) => !this.estudiantesColegios().has(id));
    return cargando ? [] : this.orden().filter((e) => !e.colegioId || !this.colegioIds().includes(e.colegioId));
  });

  constructor() {
    const { jornada, colegioIds, estudianteIds } = this.form.controls;
    jornada.valueChanges.pipe(distinctUntilChanged(), takeUntilDestroyed()).subscribe((valor) => {
      // Los colegios y estudiantes son de la jornada: al cambiarla se empieza de nuevo.
      if (!this.reiniciando && colegioIds.value.length) {
        colegioIds.setValue([]);
        estudianteIds.setValue([]);
        this.porPrecargar.set([]);
      }
      this.jornada.set(valor);
      this.emitir();
    });
    colegioIds.valueChanges.pipe(takeUntilDestroyed()).subscribe((ids) => {
      this.colegioIds.set(ids);
      this.emitir();
    });
    estudianteIds.valueChanges.pipe(takeUntilDestroyed()).subscribe((ids) => this.estudianteIds.set(ids));

    effect(() => {
      const ruta = this.ruta();
      untracked(() => {
        this.reiniciando = true;
        if (ruta) {
          const { id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = ruta;
          this.form.reset(datos);
        } else {
          this.form.reset();
        }
        this.reiniciando = false;
        this.porPrecargar.set([]);
        this.marcados.set(new Set());
        this.colegioPorAgregar.set('');
        this.jornada.set(this.form.controls.jornada.value);
        this.colegioIds.set(this.form.controls.colegioIds.value);
        this.estudianteIds.set(this.form.controls.estudianteIds.value);
        this.emitir();
      });
      if (this.soloLectura()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });

    // Precarga: cuando llegan los estudiantes de un colegio recién agregado, entran todos los de la jornada que no
    // vayan ya en otra ruta activa (al final del orden).
    effect(() => {
      const pendientes = this.porPrecargar();
      const datos = this.estudiantesColegios();
      if (!pendientes.length) return;
      const listos = pendientes.filter((id) => datos.has(id));
      if (!listos.length) return;
      untracked(() => {
        const ocupados = this.ocupados();
        const actuales = this.form.controls.estudianteIds.value;
        const nuevos = listos.flatMap((id) => datos.get(id)?.jornada ?? []).map((o) => o.id).filter((id) => !actuales.includes(id) && !ocupados.has(id));
        if (nuevos.length) this.cambiarEstudiantes([...actuales, ...nuevos]);
        this.porPrecargar.update((lista) => lista.filter((id) => !listos.includes(id)));
      });
    });
  }

  private motivoVacio(jornada: OpcionCatalogo[], ocupados: ReadonlyMap<string, string>): string {
    const nombreJornada = this.form.controls.jornada.value;
    if (!jornada.length) {
      return `Este colegio no tiene estudiantes activos en la jornada ${nombreJornada}. Revisa la jornada y el estado de sus estudiantes en Personas › Estudiantes.`;
    }
    const rutas = [...new Set(jornada.map((o) => ocupados.get(o.id)).filter((r): r is string => !!r))];
    if (rutas.length && jornada.every((o) => ocupados.has(o.id))) {
      return `Sus ${jornada.length} estudiantes de la jornada ${nombreJornada} ya van en ${rutas.length > 1 ? 'las rutas' : 'la ruta'} ${rutas.join(', ')}.`;
    }
    return 'Quitaste a todos sus estudiantes; puedes volver a agregarlos abajo.';
  }

  private opcion(id: string): OpcionCatalogo {
    const nombre = this.nombreEstudiante().get(id) ?? 'Estudiante';
    const cargado = this.colegioDe().has(id);
    return { id, nombre: cargado && !this.deLaJornada().has(id) ? `${nombre} (otra jornada)` : nombre };
  }

  private emitir(): void {
    this.colegiosCambiados.emit({ jornada: this.form.controls.jornada.value, colegioIds: this.form.controls.colegioIds.value });
  }

  private cambiarEstudiantes(ids: string[]): void {
    this.form.controls.estudianteIds.setValue(ids);
    this.form.controls.estudianteIds.markAsDirty();
  }

  protected agregarColegio(): void {
    const id = this.colegioPorAgregar();
    if (!id || this.form.controls.colegioIds.value.includes(id)) return;
    this.porPrecargar.update((lista) => [...lista, id]);
    this.colegioAgregado.emit(id);
    this.form.controls.colegioIds.setValue([...this.form.controls.colegioIds.value, id]);
    this.form.controls.colegioIds.markAsDirty();
    this.colegioPorAgregar.set('');
  }

  /** Quita el colegio y sus estudiantes de la ruta. */
  protected quitarColegio(bloque: BloqueColegio): void {
    const ids = new Set(bloque.estudiantes.map((e) => e.id));
    this.cambiarEstudiantes(this.form.controls.estudianteIds.value.filter((id) => !ids.has(id)));
    this.form.controls.colegioIds.setValue(this.form.controls.colegioIds.value.filter((id) => id !== bloque.colegioId));
    this.porPrecargar.update((lista) => lista.filter((id) => id !== bloque.colegioId));
    this.marcados.update((m) => new Set([...m].filter((id) => !ids.has(id))));
  }

  protected agregarEstudiante(id: string): void {
    if (!id || this.form.controls.estudianteIds.value.includes(id)) return;
    this.cambiarEstudiantes([...this.form.controls.estudianteIds.value, id]);
  }

  protected quitar(ids: string[]): void {
    const quitar = new Set(ids);
    this.cambiarEstudiantes(this.form.controls.estudianteIds.value.filter((id) => !quitar.has(id)));
    this.marcados.update((m) => new Set([...m].filter((id) => !quitar.has(id))));
  }

  protected marcadosDe(bloque: BloqueColegio): string[] {
    const m = this.marcados();
    return bloque.estudiantes.filter((e) => m.has(e.id)).map((e) => e.id);
  }

  protected todosMarcados(bloque: BloqueColegio): boolean {
    return bloque.estudiantes.length > 0 && this.marcadosDe(bloque).length === bloque.estudiantes.length;
  }

  protected alternar(id: string, marcado: boolean): void {
    this.marcados.update((m) => {
      const copia = new Set(m);
      if (marcado) copia.add(id);
      else copia.delete(id);
      return copia;
    });
  }

  protected alternarTodos(bloque: BloqueColegio, marcado: boolean): void {
    this.marcados.update((m) => {
      const copia = new Set(m);
      for (const e of bloque.estudiantes) {
        if (marcado) copia.add(e.id);
        else copia.delete(e.id);
      }
      return copia;
    });
  }

  /** Orden de recogida: sube o baja una posición. */
  protected mover(indice: number, delta: -1 | 1): void {
    const ids = this.form.controls.estudianteIds.value;
    const hasta = indice + delta;
    if (hasta < 0 || hasta >= ids.length) return;
    this.cambiarEstudiantes(moverEnLista(ids, indice, hasta));
    this.anuncio.set(`${this.opcion(ids[indice]).nombre} quedó de ${hasta + 1}.`);
  }

  /** Lleva un estudiante a una posición escrita (1 = primero). */
  protected moverA(indice: number, posicion: number): void {
    const ids = this.form.controls.estudianteIds.value;
    const hasta = Math.max(0, Math.min(ids.length - 1, Math.round(posicion) - 1));
    if (Number.isNaN(hasta) || hasta === indice) return;
    this.cambiarEstudiantes(moverEnLista(ids, indice, hasta));
    this.anuncio.set(`${this.opcion(ids[indice]).nombre} quedó de ${hasta + 1}.`);
  }

  /** Agrupa el orden por colegio, en el orden de los colegios (conserva el orden dentro de cada uno). */
  protected agruparPorColegio(): void {
    const colegioDe = this.colegioDe();
    const posicion = new Map(this.form.controls.colegioIds.value.map((id, i) => [id, i]));
    const ids = [...this.form.controls.estudianteIds.value];
    const clave = (id: string) => posicion.get(colegioDe.get(id) ?? '') ?? Number.MAX_SAFE_INTEGER;
    this.cambiarEstudiantes(ids.map((id, i) => ({ id, i })).sort((a, b) => clave(a.id) - clave(b.id) || a.i - b.i).map((x) => x.id));
    this.anuncio.set('Estudiantes agrupados por colegio.');
  }

  protected error(campo: keyof typeof this.form.controls): string | null {
    const control = this.form.controls[campo];
    if (campo === 'colegioIds' && control.touched && control.hasError('required')) return 'Agrega al menos un colegio.';
    return mensajeError(control);
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
