import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AccionesFila } from 'src/app/shared/acciones-fila/acciones-fila';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { EstadoVacio } from 'src/app/shared/estado-vacio/estado-vacio';
import { Ruta } from '../ruta';

@Component({
  selector: 'app-rutas-tabla',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccionesFila, BadgeEstado, EstadoVacio],
  template: `
    <div class="@container overflow-x-auto rounded-box border border-base-300">
      <table class="table">
        <thead>
          <tr class="bg-base-300 text-base-content/80 text-xs uppercase tracking-wide">
            <th>Ruta</th>
            <th class="hidden @3xl:table-cell">Colegio</th>
            <th class="hidden @3xl:table-cell">Jornada</th>
            <th>Estudiantes</th>
            <th class="hidden @6xl:table-cell">Asignación</th>
            <th>Estado</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="transition-opacity" [class.opacity-50]="cargando() && rutas().length > 0">
          @if (cargando() && rutas().length === 0) {
            @for (fila of [1, 2, 3, 4]; track fila) {
              <tr class="border-base-300">
                @for (col of [1, 2, 3, 4, 5, 6, 7]; track col) {
                  <td><div class="skeleton bg-base-300 h-4 w-full"></div></td>
                }
              </tr>
            }
          } @else {
            @for (ruta of rutas(); track ruta.id) {
              <tr class="border-base-300 hover:bg-base-300/50 cursor-pointer transition-colors" (click)="consultar.emit(ruta)">
                <td>
                  <div class="flex items-center gap-3">
                    <span class="badge bg-primary text-primary-content border-0 font-mono font-bold">{{ ruta.codigo }}</span>
                    <div class="min-w-0">
                      <div class="font-semibold truncate">{{ ruta.nombre }}</div>
                      <div class="text-xs text-base-content/70 truncate max-w-56">{{ ruta.sector }}</div>
                    </div>
                  </div>
                </td>
                <td class="hidden @3xl:table-cell text-base-content/90" [title]="colegiosDe(ruta)">
                  {{ nombresColegio().get(ruta.colegioIds[0]) ?? '—' }}
                  @if (ruta.colegioIds.length > 1) {
                    <span class="badge badge-sm bg-base-300 ml-1">+{{ ruta.colegioIds.length - 1 }}</span>
                  }
                </td>
                <td class="hidden @3xl:table-cell">{{ ruta.jornada }}</td>
                <td class="whitespace-nowrap"><i class="fa-solid fa-children text-xs text-base-content/70"></i> {{ ruta.estudianteIds.length }}</td>
                <td class="hidden @6xl:table-cell">
                  @if (asignaciones().get(ruta.id); as asignacion) {
                    <span class="text-sm">{{ asignacion }}</span>
                  } @else {
                    <span class="badge badge-warning badge-soft badge-sm">Sin asignar</span>
                  }
                </td>
                <td><app-badge-estado [estado]="ruta.estado" textoActivo="Activa" textoInactivo="Inactiva" /></td>
                <td class="text-right whitespace-nowrap">
                  <app-acciones-fila (consultar)="consultar.emit(ruta)" (editar)="editar.emit(ruta)" (eliminar)="eliminar.emit(ruta)" />
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">
                  <app-estado-vacio icono="fa-solid fa-route" mensaje="Aún no hay rutas registradas." textoCrear="Registrar la primera"
                    [hayFiltros]="hayFiltros()" (crear)="crear.emit()" />
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
})
export class RutasTabla {
  readonly rutas = input.required<Ruta[]>();
  readonly nombresColegio = input<ReadonlyMap<string, string>>(new Map());

  /** Todos los colegios de la ruta (tooltip de la columna). */
  protected colegiosDe(ruta: Ruta): string {
    return ruta.colegioIds.map((id) => this.nombresColegio().get(id) ?? '').filter(Boolean).join(', ');
  }
  /** rutaId → "placa · conductor" de la asignación activa. */
  readonly asignaciones = input<ReadonlyMap<string, string>>(new Map());
  readonly cargando = input(false);
  readonly hayFiltros = input(false);

  readonly consultar = output<Ruta>();
  readonly editar = output<Ruta>();
  readonly eliminar = output<Ruta>();
  readonly crear = output<void>();
}
