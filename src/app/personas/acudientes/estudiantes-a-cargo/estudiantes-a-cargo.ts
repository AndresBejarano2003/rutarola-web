import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { ColegiosRepositorio } from 'src/app/operacion/colegios/colegios-repositorio';
import { OpcionCatalogo, aMapa } from 'src/app/shared/catalogos/catalogos';
import { CeldaPersona } from 'src/app/shared/celda-persona/celda-persona';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { iniciales, nombreCompleto } from '../../compartido/persona';
import { Estudiante, FILTROS_ESTUDIANTE_VACIOS } from '../../estudiantes/estudiante';
import { EstudiantesRepositorio } from '../../estudiantes/estudiantes-repositorio';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; estudiantes: Estudiante[] }
  | { tipo: 'error'; mensaje: string };

/** Lista de los estudiantes asignados a un acudiente (consulta al módulo de estudiantes). */
@Component({
  selector: 'app-estudiantes-a-cargo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CeldaPersona, BadgeEstado],
  template: `
    @switch (estado().tipo) {
      @case ('cargando') {
        <div class="space-y-2">
          <div class="skeleton bg-base-300 h-12 w-full"></div>
          <div class="skeleton bg-base-300 h-12 w-full"></div>
        </div>
      }
      @case ('error') {
        <div role="alert" class="alert alert-error text-sm">{{ mensajeError() }}</div>
      }
      @default {
        @let lista = estudiantes();
        @if (lista.length === 0) {
          <p class="text-base-content/70 text-sm py-2">
            <i class="fa-solid fa-circle-info text-info"></i> No tiene estudiantes a cargo.
          </p>
        } @else {
          <ul class="divide-y divide-base-300 rounded-box border border-base-300">
            @for (estudiante of lista; track estudiante.id) {
              <li class="flex items-center justify-between gap-3 px-3 py-2">
                <app-celda-persona [nombre]="nombreCompleto(estudiante)" [iniciales]="iniciales(estudiante)" [foto]="estudiante.foto"
                  [activo]="estudiante.estado === 'ACTIVO'"
                  [detalle]="(nombresColegio().get(estudiante.colegioId) ?? '') + ' · ' + estudiante.grado + ' · ' + estudiante.jornada" />
                <app-badge-estado [estado]="estudiante.estado" />
              </li>
            }
          </ul>
        }
      }
    }
  `,
})
export class EstudiantesACargo {
  readonly acudienteId = input.required<string>();

  private readonly repositorio = inject(EstudiantesRepositorio);
  private readonly colegios = toSignal(inject(ColegiosRepositorio).opciones().pipe(catchError(() => of<OpcionCatalogo[]>([]))), {
    initialValue: [],
  });
  protected readonly nombresColegio = computed(() => aMapa(this.colegios()));
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly iniciales = iniciales;

  protected readonly estado = toSignal(
    toObservable(this.acudienteId).pipe(
      switchMap((acudienteId) =>
        this.repositorio.listar({ ...FILTROS_ESTUDIANTE_VACIOS, acudienteId }, { pagina: 1, tamano: 100 }).pipe(
          map(({ items }): Estado => ({ tipo: 'listo', estudiantes: items })),
          catchError((error: unknown) => of<Estado>({ tipo: 'error', mensaje: mensajeDeError(error) })),
          startWith<Estado>({ tipo: 'cargando' }),
        ),
      ),
    ),
    { initialValue: { tipo: 'cargando' } as Estado },
  );

  protected estudiantes(): Estudiante[] {
    const estado = this.estado();
    return estado.tipo === 'listo' ? estado.estudiantes : [];
  }

  protected mensajeError(): string {
    const estado = this.estado();
    return estado.tipo === 'error' ? estado.mensaje : '';
  }
}
