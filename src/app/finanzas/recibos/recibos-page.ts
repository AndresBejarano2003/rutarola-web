import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { MEDIOS_PAGO } from './recibo';
import { PaginaCrud } from 'src/app/shared/crud/pagina-crud';
import { GeneradorPdf } from 'src/app/shared/documentos-pdf/generador-pdf';
import { contenidoRecibo } from 'src/app/shared/documentos-pdf/documentos-pdf';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { Modal } from 'src/app/shared/modal/modal';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { Factura } from '../facturas/factura';
import { FacturasRepositorio } from '../facturas/facturas-repositorio';
import { FILTROS_RECIBO_VACIOS, FiltrosRecibo, Recibo } from './recibo';
import { ReciboFormulario } from './recibo-formulario/recibo-formulario';
import { RecibosFiltros } from './recibos-filtros/recibos-filtros';
import { RecibosRepositorio } from './recibos-repositorio';
import { RecibosStore } from './recibos-store';
import { RecibosTabla } from './recibos-tabla/recibos-tabla';

interface DetalleFactura {
  factura: Factura | null;
  pagados: string[];
}

@Component({
  selector: 'app-recibos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RecibosFiltros, RecibosTabla, ReciboFormulario, EncabezadoListado, AccionesFormulario, Modal, DialogoConfirmacion, Paginacion],
  providers: [RecibosStore],
  templateUrl: './recibos-page.html',
})
export default class RecibosPage extends PaginaCrud<Recibo, FiltrosRecibo> {
  protected readonly store = inject(RecibosStore);
  private readonly pdf = inject(GeneradorPdf);

  /** Abre "Imprimir / Guardar como PDF" con el formato de la empresa (Inicio › Configuración › Documentos PDF). */
  protected descargarPdf(f: Recibo): void {
    void this.pdf.descargar(contenidoRecibo(f, MEDIOS_PAGO.find((m) => m.id === f.medioPago)?.nombre ?? f.medioPago));
  }
  protected readonly titulos = { crear: 'Registrar pago', editar: 'Editar recibo', consultar: 'Detalle del recibo' };

  private readonly facturasRepo = inject(FacturasRepositorio);
  private readonly recibosRepo = inject(RecibosRepositorio);

  protected readonly facturas = toSignal(this.facturasRepo.opciones().pipe(catchError(() => of<OpcionCatalogo[]>([]))), {
    initialValue: [],
  });

  /** Factura elegida en el formulario y sus meses ya pagados. */
  protected readonly facturaFormulario = signal('');
  protected readonly detalleFactura = toSignal(
    toObservable(this.facturaFormulario).pipe(
      switchMap((id) =>
        id
          ? forkJoin([
              this.facturasRepo.obtener(id),
              this.recibosRepo.listar({ ...FILTROS_RECIBO_VACIOS, facturaId: id, estado: 'ACTIVO' }, SIN_PAGINAR),
            ]).pipe(
              map(([factura, { items }]): DetalleFactura => ({ factura, pagados: items.map((r) => r.periodo) })),
              catchError(() => of<DetalleFactura>({ factura: null, pagados: [] })),
            )
          : of<DetalleFactura>({ factura: null, pagados: [] }),
      ),
    ),
    { initialValue: { factura: null, pagados: [] } as DetalleFactura },
  );

  protected describir(r: Recibo): string {
    return `el recibo ${r.numero} (${r.nombreEstudiante}, ${nombrePeriodo(r.periodo, true)})`;
  }
}
