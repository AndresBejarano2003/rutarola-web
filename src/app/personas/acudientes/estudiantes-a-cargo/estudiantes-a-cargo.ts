import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { ColegiosRepositorio } from 'src/app/operacion/colegios/colegios-repositorio';
import { OpcionCatalogo, aMapa } from 'src/app/shared/catalogos/catalogos';
import { CeldaPersona } from 'src/app/shared/celda-persona/celda-persona';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { iniciales, nombreCompleto } from '../../compartido/persona';
import { Estudiante, FILTROS_ESTUDIANTE_VACIOS } from '../../estudiantes/estudiante';
import { AltaEstudiante } from '../../estudiantes/alta-estudiante/alta-estudiante';
import { EstudiantesRepositorio } from '../../estudiantes/estudiantes-repositorio';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; estudiantes: Estudiante[] }
  | { tipo: 'error'; mensaje: string };

/**
 * Lista de los estudiantes asignados a un acudiente (consulta al módulo de estudiantes). Con `permitirAgregar`
 * ofrece "Agregar estudiante": registro rápido encima, con el acudiente ya elegido, y la lista se recarga.
 */
@Component({
  selector: 'app-estudiantes-a-cargo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CeldaPersona, BadgeEstado, AltaEstudiante],
  template: `
    @if (permitirAgregar()) {
      <div class="flex justify-end mb-2">
        <button type="button" class="btn btn-secondary btn-sm" (click)="altaAbierta.set(true)">
          <i class="fa-solid fa-user-plus" aria-hidden="true"></i> Agregar estudiante
        </button>
      </div>
      <app-alta-estudiante [(abierto)]="altaAbierta" [acudienteId]="acudienteId()" [nombreAcudiente]="nombreAcudiente()"
        (creado)="recargar()" />
    }
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
  readonly permitirAgregar = input(false, { transform: booleanAttribute });
  readonly nombreAcudiente = input('');

  protected readonly altaAbierta = signal(false);
  private readonly version = signal(0);

  private readonly repositorio = inject(EstudiantesRepositorio);
  private readonly colegios = toSignal(inject(ColegiosRepositorio).opciones().pipe(catchError(() => of<OpcionCatalogo[]>([]))), {
    initialValue: [],
  });
  protected readonly nombresColegio = computed(() => aMapa(this.colegios()));
  protected readonly nombreCompleto = nombreCompleto;
  protected readonly iniciales = iniciales;

  protected readonly estado = toSignal(
    combineLatest([toObservable(this.acudienteId), toObservable(this.version)]).pipe(
      switchMap(([acudienteId]) =>
        this.repositorio.listar({ ...FILTROS_ESTUDIANTE_VACIOS, acudienteId }, { pagina: 1, tamano: 100 }).pipe(
          map(({ items }): Estado => ({ tipo: 'listo', estudiantes: items })),
          catchError((error: unknown) => of<Estado>({ tipo: 'error', mensaje: mensajeDeError(error) })),
          startWith<Estado>({ tipo: 'cargando' }),
        ),
      ),
    ),
    { initialValue: { tipo: 'cargando' } as Estado },
  );

  protected recargar(): void {
    this.version.update((v) => v + 1);
  }

  protected estudiantes(): Estudiante[] {
    const estado = this.estado();
    return estado.tipo === 'listo' ? estado.estudiantes : [];
  }

  protected mensajeError(): string {
    const estado = this.estado();
    return estado.tipo === 'error' ? estado.mensaje : '';
  }
}
