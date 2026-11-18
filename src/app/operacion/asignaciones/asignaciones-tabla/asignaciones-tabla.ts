import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AccionesFila } from 'src/app/shared/acciones-fila/acciones-fila';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { EstadoVacio } from 'src/app/shared/estado-vacio/estado-vacio';
import { fechaCorta } from 'src/app/shared/fechas/fechas';
import { Asignacion, textoHorario } from '../asignacion';

/** Nombres para mostrar (vienen de los módulos de rutas, vehículos y empleados). */
export interface NombresAsignacion {
  rutas: ReadonlyMap<string, string>;
  vehiculos: ReadonlyMap<string, string>;
  empleados: ReadonlyMap<string, string>;
}

@Component({
  selector: 'app-asignaciones-tabla',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccionesFila, BadgeEstado, EstadoVacio],
  template: `
    <div class="@container overflow-x-auto rounded-box border border-base-300">
      <table class="table">
        <thead>
          <tr class="bg-base-300 text-base-content/80 text-xs uppercase tracking-wide">
            <th>Ruta</th>
            <th>Vehículo</th>
            <th>Conductor</th>
            <th class="hidden @3xl:table-cell">Monitora</th>
            <th class="hidden @5xl:table-cell">Vigencia y horario</th>
            <th>Estado</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="transition-opacity" [class.opacity-50]="cargando() && asignaciones().length > 0">
          @if (cargando() && asignaciones().length === 0) {
            @for (fila of [1, 2, 3]; track fila) {
              <tr class="border-base-300">
                @for (col of [1, 2, 3, 4, 5, 6, 7]; track col) {
                  <td><div class="skeleton bg-base-300 h-4 w-full"></div></td>
                }
              </tr>
            }
          } @else {
            @for (a of asignaciones(); track a.id) {
              <tr class="border-base-300 hover:bg-base-300/50 cursor-pointer transition-colors" (click)="consultar.emit(a)">
                <td class="font-semibold">{{ nombres().rutas.get(a.rutaId) ?? '—' }}</td>
                <td class="whitespace-nowrap">
                  <i class="fa-solid fa-bus text-xs text-base-content/70"></i> {{ nombres().vehiculos.get(a.vehiculoId) ?? '—' }}
                </td>
                <td>{{ nombres().empleados.get(a.conductorId) ?? '—' }}</td>
                <td class="hidden @3xl:table-cell">{{ a.monitoraId ? (nombres().empleados.get(a.monitoraId) ?? '—') : 'Sin monitora' }}</td>
                <td class="hidden @5xl:table-cell whitespace-nowrap text-sm">
                  {{ fechaCorta(a.fechaInicio) }} – {{ a.fechaFin ? fechaCorta(a.fechaFin) : 'Indefinida' }}
                  <div class="text-xs text-base-content/70">
                    <i class="fa-regular fa-clock" aria-hidden="true"></i> {{ textoHorario(a) || 'Toda la jornada' }}
                  </div>
                </td>
                <td><app-badge-estado [estado]="a.estado" textoActivo="Activa" textoInactivo="Inactiva" /></td>
                <td class="text-right whitespace-nowrap">
                  <app-acciones-fila (consultar)="consultar.emit(a)" (editar)="editar.emit(a)" (eliminar)="eliminar.emit(a)" />
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">
                  <app-estado-vacio icono="fa-solid fa-diagram-project" mensaje="Aún no hay asignaciones registradas."
                    textoCrear="Registrar la primera" [hayFiltros]="hayFiltros()" (crear)="crear.emit()" />
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AsignacionesTabla {
  protected readonly textoHorario = textoHorario;
  readonly asignaciones = input.required<Asignacion[]>();
  readonly nombres = input.required<NombresAsignacion>();
  readonly cargando = input(false);
  readonly hayFiltros = input(false);

  readonly consultar = output<Asignacion>();
  readonly editar = output<Asignacion>();
  readonly eliminar = output<Asignacion>();
  readonly crear = output<void>();

  protected readonly fechaCorta = fechaCorta;
}
