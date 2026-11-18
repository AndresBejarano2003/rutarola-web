import { PanelFiltros } from 'src/app/shared/panel-filtros/panel-filtros';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CatalogosService, OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { ESTADOS_REGISTRO, EstadoRegistro } from 'src/app/shared/crud/crud';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { FILTROS_ESTUDIANTE_VACIOS, FiltrosEstudiante } from '../estudiante';

/** Filtros con búsqueda en vivo (300 ms después de dejar de escribir). */
@Component({
  selector: 'app-estudiantes-filtros',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFiltros, ReactiveFormsModule, SelectorBusqueda],
  templateUrl: './estudiantes-filtros.html',
})
export class EstudiantesFiltros {
  /** Opciones del módulo de acudientes. */
  readonly acudientes = input<OpcionCatalogo[]>([]);
  /** Opciones del módulo de colegios. */
  readonly colegios = input<OpcionCatalogo[]>([]);
  readonly cambiar = output<FiltrosEstudiante>();

  protected readonly catalogos = inject(CatalogosService);
  protected readonly estados = ESTADOS_REGISTRO;

  protected readonly form = inject(NonNullableFormBuilder).group({
    texto: FILTROS_ESTUDIANTE_VACIOS.texto,
    acudienteId: FILTROS_ESTUDIANTE_VACIOS.acudienteId,
    colegioId: FILTROS_ESTUDIANTE_VACIOS.colegioId,
    grado: FILTROS_ESTUDIANTE_VACIOS.grado,
    jornada: FILTROS_ESTUDIANTE_VACIOS.jornada,
    estado: FILTROS_ESTUDIANTE_VACIOS.estado as EstadoRegistro | '',
  });

  constructor() {
    this.form.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.cambiar.emit(this.form.getRawValue()));
  }

  protected limpiar(): void {
    this.form.reset();
  }
}
