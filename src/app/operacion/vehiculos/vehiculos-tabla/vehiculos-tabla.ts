import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AccionesFila } from 'src/app/shared/acciones-fila/acciones-fila';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { aMapa } from 'src/app/shared/catalogos/catalogos';
import { EstadoVacio } from 'src/app/shared/estado-vacio/estado-vacio';
import { Avatar } from 'src/app/shared/foto/avatar';
import { BadgeVencimiento } from 'src/app/shared/vencimiento/vencimiento';
import { TIPOS_VEHICULO, Vehiculo, estadoDocumentos } from '../vehiculo';

@Component({
  selector: 'app-vehiculos-tabla',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccionesFila, Avatar, BadgeEstado, BadgeVencimiento, EstadoVacio],
  template: `
    <div class="@container overflow-x-auto rounded-box border border-base-300">
      <table class="table">
        <thead>
          <tr class="bg-base-300 text-base-content/80 text-xs uppercase tracking-wide">
            <th>Vehículo</th>
            <th class="hidden @3xl:table-cell">Interno</th>
            <th class="hidden @5xl:table-cell">Tipo</th>
            <th class="hidden @3xl:table-cell">Capacidad</th>
            <th>Documentos</th>
            <th>Estado</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="transition-opacity" [class.opacity-50]="cargando() && vehiculos().length > 0">
          @if (cargando() && vehiculos().length === 0) {
            @for (fila of [1, 2, 3, 4, 5]; track fila) {
              <tr class="border-base-300">
                @for (col of [1, 2, 3, 4, 5, 6, 7]; track col) {
                  <td><div class="skeleton bg-base-300 h-4 w-full"></div></td>
                }
              </tr>
            }
          } @else {
            @for (vehiculo of vehiculos(); track vehiculo.id) {
              <tr class="border-base-300 hover:bg-base-300/50 cursor-pointer transition-colors" (click)="consultar.emit(vehiculo)">
                <td>
                  <div class="flex items-center gap-3">
                    @if (vehiculo.foto) {
                      <app-avatar [foto]="vehiculo.foto" [alt]="'Foto del vehículo ' + vehiculo.placa" tamano="md" />
                    } @else {
                      <span class="w-10 h-10 rounded-full bg-base-300 grid place-items-center shrink-0" aria-hidden="true">
                        <i class="fa-solid fa-van-shuttle text-base-content/60"></i>
                      </span>
                    }
                    <span class="badge bg-primary text-primary-content border-0 font-mono font-bold tracking-wider">{{ vehiculo.placa }}</span>
                    <div class="min-w-0">
                      <div class="font-semibold truncate">{{ vehiculo.marca }} {{ vehiculo.linea }}</div>
                      <div class="text-xs text-base-content/70">Modelo {{ vehiculo.modelo }} · {{ vehiculo.color }}</div>
                    </div>
                  </div>
                </td>
                <td class="hidden @3xl:table-cell font-mono">{{ vehiculo.numeroInterno }}</td>
                <td class="hidden @5xl:table-cell">{{ nombresTipo.get(vehiculo.tipo) }}</td>
                <td class="hidden @3xl:table-cell whitespace-nowrap"><i class="fa-solid fa-user-group text-xs text-base-content/70"></i> {{ vehiculo.capacidad }}</td>
                <td><app-badge-vencimiento [estadoFijo]="estadoDocumentos(vehiculo)" [mostrarFecha]="false" textoVigente="Al día" /></td>
                <td><app-badge-estado [estado]="vehiculo.estado" /></td>
                <td class="text-right whitespace-nowrap">
                  <app-acciones-fila (consultar)="consultar.emit(vehiculo)" (editar)="editar.emit(vehiculo)" (eliminar)="eliminar.emit(vehiculo)" />
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">
                  <app-estado-vacio icono="fa-solid fa-bus" mensaje="Aún no hay vehículos registrados." [hayFiltros]="hayFiltros()"
                    (crear)="crear.emit()" />
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
})
export class VehiculosTabla {
  readonly vehiculos = input.required<Vehiculo[]>();
  readonly cargando = input(false);
  readonly hayFiltros = input(false);

  readonly consultar = output<Vehiculo>();
  readonly editar = output<Vehiculo>();
  readonly eliminar = output<Vehiculo>();
  readonly crear = output<void>();

  protected readonly nombresTipo = aMapa(TIPOS_VEHICULO);
  protected readonly estadoDocumentos = estadoDocumentos;
}
