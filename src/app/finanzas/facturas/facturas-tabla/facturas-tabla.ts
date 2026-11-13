import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AccionesFila } from 'src/app/shared/acciones-fila/acciones-fila';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { EstadoVacio } from 'src/app/shared/estado-vacio/estado-vacio';
import { nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { Factura, mesesFactura, totalFactura } from '../factura';

@Component({
  selector: 'app-facturas-tabla',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccionesFila, BadgeEstado, EstadoVacio, CurrencyPipe],
  template: `
    <div class="@container overflow-x-auto rounded-box border border-base-300">
      <table class="table">
        <thead>
          <tr class="bg-base-300 text-base-content/80 text-xs uppercase tracking-wide">
            <th>Factura</th>
            <th class="hidden @5xl:table-cell">Acudiente</th>
            <th>Estudiante</th>
            <th class="hidden @3xl:table-cell text-right">Valor mensual</th>
            <th class="hidden @6xl:table-cell">Periodo</th>
            <th class="hidden @6xl:table-cell text-right">Total contrato</th>
            <th>Estado</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="transition-opacity" [class.opacity-50]="cargando() && facturas().length > 0">
          @if (cargando() && facturas().length === 0) {
            @for (fila of [1, 2, 3, 4]; track fila) {
              <tr class="border-base-300">
                @for (col of [1, 2, 3, 4, 5, 6, 7, 8]; track col) {
                  <td><div class="skeleton bg-base-300 h-4 w-full"></div></td>
                }
              </tr>
            }
          } @else {
            @for (f of facturas(); track f.id) {
              <tr class="border-base-300 hover:bg-base-300/50 cursor-pointer transition-colors" (click)="consultar.emit(f)">
                <td>
                  <div class="font-mono font-semibold">{{ f.numero }}</div>
                  <div class="text-xs text-base-content/70 truncate max-w-40">{{ f.concepto }}</div>
                </td>
                <td class="hidden @5xl:table-cell">{{ f.nombreAcudiente }}</td>
                <td>{{ f.nombreEstudiante }}</td>
                <td class="hidden @3xl:table-cell text-right whitespace-nowrap font-semibold">{{ f.valorContratacion | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</td>
                <td class="hidden @6xl:table-cell whitespace-nowrap text-sm">
                  {{ nombrePeriodo(f.periodoInicio) }} – {{ nombrePeriodo(f.periodoFin) }}
                  <div class="text-xs text-base-content/70">{{ meses(f) }} meses</div>
                </td>
                <td class="hidden @6xl:table-cell text-right whitespace-nowrap">{{ total(f) | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</td>
                <td><app-badge-estado [estado]="f.estado" textoActivo="Vigente" textoInactivo="Anulada" /></td>
                <td class="text-right whitespace-nowrap">
                  <app-acciones-fila (consultar)="consultar.emit(f)" (editar)="editar.emit(f)" (eliminar)="eliminar.emit(f)">
                    <div class="tooltip tooltip-left" data-tip="Descargar PDF">
                      <button type="button" class="btn btn-sm btn-ghost btn-square text-info hover:bg-info/15" aria-label="Descargar PDF" (click)="pdf.emit(f)">
                        <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
                      </button>
                    </div>
                  </app-acciones-fila>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8">
                  <app-estado-vacio icono="fa-solid fa-file-invoice-dollar" mensaje="Aún no hay facturas registradas."
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
export class FacturasTabla {
  readonly facturas = input.required<Factura[]>();
  readonly cargando = input(false);
  readonly hayFiltros = input(false);

  readonly consultar = output<Factura>();
  readonly editar = output<Factura>();
  readonly eliminar = output<Factura>();
  /** Descargar el PDF con el formato de la empresa. */
  readonly pdf = output<Factura>();
  readonly crear = output<void>();

  protected readonly nombrePeriodo = nombrePeriodo;
  protected readonly total = totalFactura;
  protected meses(f: Factura): number {
    return mesesFactura(f).length;
  }
}
