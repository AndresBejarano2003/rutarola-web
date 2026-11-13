import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AccionesFila } from 'src/app/shared/acciones-fila/acciones-fila';
import { BadgeEstado } from 'src/app/shared/badge-estado/badge-estado';
import { EstadoVacio } from 'src/app/shared/estado-vacio/estado-vacio';
import { fechaCorta, nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { MEDIOS_PAGO, Recibo } from '../recibo';

@Component({
  selector: 'app-recibos-tabla',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccionesFila, BadgeEstado, EstadoVacio, CurrencyPipe],
  template: `
    <div class="@container overflow-x-auto rounded-box border border-base-300">
      <table class="table">
        <thead>
          <tr class="bg-base-300 text-base-content/80 text-xs uppercase tracking-wide">
            <th>Recibo</th>
            <th>Factura / estudiante</th>
            <th class="hidden @3xl:table-cell">Mes pagado</th>
            <th class="text-right">Valor</th>
            <th class="hidden @5xl:table-cell">Medio de pago</th>
            <th class="hidden @3xl:table-cell">Estado</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="transition-opacity" [class.opacity-50]="cargando() && recibos().length > 0">
          @if (cargando() && recibos().length === 0) {
            @for (fila of [1, 2, 3, 4, 5]; track fila) {
              <tr class="border-base-300">
                @for (col of [1, 2, 3, 4, 5, 6, 7]; track col) {
                  <td><div class="skeleton bg-base-300 h-4 w-full"></div></td>
                }
              </tr>
            }
          } @else {
            @for (r of recibos(); track r.id) {
              @let medio = medios.get(r.medioPago);
              <tr class="border-base-300 hover:bg-base-300/50 cursor-pointer transition-colors" (click)="consultar.emit(r)">
                <td>
                  <div class="font-mono font-semibold">{{ r.numero }}</div>
                  <div class="text-xs text-base-content/70">{{ fechaCorta(r.fechaPago) }}</div>
                </td>
                <td>
                  <div class="font-medium">{{ r.nombreEstudiante }}</div>
                  <div class="text-xs text-base-content/70">{{ r.numeroFactura }} · {{ r.nombreAcudiente }}</div>
                </td>
                <td class="hidden @3xl:table-cell whitespace-nowrap capitalize">{{ nombrePeriodo(r.periodo, true) }}</td>
                <td class="text-right whitespace-nowrap font-semibold">{{ r.valor | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</td>
                <td class="hidden @5xl:table-cell whitespace-nowrap">
                  <i class="text-xs text-base-content/70" [class]="medio?.icono"></i> {{ medio?.nombre }}
                </td>
                <td class="hidden @3xl:table-cell"><app-badge-estado [estado]="r.estado" textoActivo="Válido" textoInactivo="Anulado" /></td>
                <td class="text-right whitespace-nowrap">
                  <app-acciones-fila (consultar)="consultar.emit(r)" (editar)="editar.emit(r)" (eliminar)="eliminar.emit(r)">
                    <div class="tooltip tooltip-left" data-tip="Descargar PDF">
                      <button type="button" class="btn btn-sm btn-ghost btn-square text-info hover:bg-info/15" aria-label="Descargar PDF" (click)="pdf.emit(r)">
                        <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
                      </button>
                    </div>
                  </app-acciones-fila>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">
                  <app-estado-vacio icono="fa-solid fa-receipt" mensaje="Aún no hay pagos registrados." textoCrear="Registrar el primero"
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
export class RecibosTabla {
  readonly recibos = input.required<Recibo[]>();
  readonly cargando = input(false);
  readonly hayFiltros = input(false);

  readonly consultar = output<Recibo>();
  readonly editar = output<Recibo>();
  readonly eliminar = output<Recibo>();
  /** Descargar el PDF con el formato de la empresa. */
  readonly pdf = output<Recibo>();
  readonly crear = output<void>();

  protected readonly medios = new Map(MEDIOS_PAGO.map((m) => [m.id, m]));
  protected readonly fechaCorta = fechaCorta;
  protected readonly nombrePeriodo = nombrePeriodo;
}
