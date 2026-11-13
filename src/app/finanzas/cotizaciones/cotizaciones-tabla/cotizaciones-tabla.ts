import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AccionesFila } from 'src/app/shared/acciones-fila/acciones-fila';
import { EstadoVacio } from 'src/app/shared/estado-vacio/estado-vacio';
import { fechaCorta } from 'src/app/shared/fechas/fechas';
import { Cotizacion, ESTADOS_COTIZACION } from '../cotizacion';

@Component({
  selector: 'app-cotizaciones-tabla',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccionesFila, EstadoVacio, CurrencyPipe],
  template: `
    <div class="@container overflow-x-auto rounded-box border border-base-300">
      <table class="table">
        <thead>
          <tr class="bg-base-300 text-base-content/80 text-xs uppercase tracking-wide">
            <th>Cotización</th>
            <th>Acudiente</th>
            <th class="hidden @3xl:table-cell">Estudiantes</th>
            <th class="hidden @5xl:table-cell text-right">Valor c/u</th>
            <th class="text-right">Total</th>
            <th>Estado</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="transition-opacity" [class.opacity-50]="cargando() && cotizaciones().length > 0">
          @if (cargando() && cotizaciones().length === 0) {
            @for (fila of [1, 2, 3, 4]; track fila) {
              <tr class="border-base-300">
                @for (col of [1, 2, 3, 4, 5, 6, 7]; track col) {
                  <td><div class="skeleton bg-base-300 h-4 w-full"></div></td>
                }
              </tr>
            }
          } @else {
            @for (c of cotizaciones(); track c.id) {
              @let estado = estados.get(c.estado);
              <tr class="border-base-300 hover:bg-base-300/50 cursor-pointer transition-colors" (click)="consultar.emit(c)">
                <td>
                  <div class="font-mono font-semibold">{{ c.numero }}</div>
                  <div class="text-xs text-base-content/70">{{ fechaCorta(c.fecha) }}</div>
                </td>
                <td>
                  <div class="font-medium">{{ c.nombreAcudiente }}</div>
                  @if (c.registrados) {
                    <span class="badge badge-info badge-soft badge-xs">Registrado</span>
                  } @else {
                    <span class="badge badge-warning badge-soft badge-xs">Cliente nuevo</span>
                  }
                </td>
                <td class="hidden @3xl:table-cell max-w-56">
                  <div class="font-medium">{{ c.estudiantes.length }}</div>
                  <div class="text-xs text-base-content/70 truncate">{{ nombres(c) }}</div>
                </td>
                <td class="hidden @5xl:table-cell text-right whitespace-nowrap">{{ c.valorPorEstudiante | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</td>
                <td class="text-right whitespace-nowrap font-semibold">{{ c.valorTotal | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</td>
                <td><span class="badge badge-soft badge-sm" [class]="estado?.clase">{{ estado?.nombre }}</span></td>
                <td class="text-right whitespace-nowrap">
                  <app-acciones-fila (consultar)="consultar.emit(c)" (editar)="editar.emit(c)" (eliminar)="eliminar.emit(c)">
                    <div class="tooltip tooltip-left" data-tip="Descargar PDF">
                      <button type="button" class="btn btn-sm btn-ghost btn-square text-info hover:bg-info/15" aria-label="Descargar PDF" (click)="pdf.emit(c)">
                        <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
                      </button>
                    </div>
                  </app-acciones-fila>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">
                  <app-estado-vacio icono="fa-solid fa-file-lines" mensaje="Aún no hay cotizaciones." textoCrear="Crear la primera"
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
export class CotizacionesTabla {
  readonly cotizaciones = input.required<Cotizacion[]>();
  readonly cargando = input(false);
  readonly hayFiltros = input(false);

  readonly consultar = output<Cotizacion>();
  readonly editar = output<Cotizacion>();
  readonly eliminar = output<Cotizacion>();
  /** Descargar el PDF con el formato de la empresa. */
  readonly pdf = output<Cotizacion>();
  readonly crear = output<void>();

  protected readonly estados = new Map(ESTADOS_COTIZACION.map((e) => [e.id, e]));
  protected readonly fechaCorta = fechaCorta;
  protected nombres(c: Cotizacion): string {
    return c.estudiantes.map((e) => e.nombre).join(', ');
  }
}
