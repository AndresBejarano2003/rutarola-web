import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { MEDIOS_PAGO } from './recibo';
import { PaginaCrud } from 'src/app/shared/crud/pagina-crud';
import { GeneradorPdf } from 'src/app/shared/documentos-pdf/generador-pdf';
import { contenidoRecibo } from 'src/app/shared/documentos-pdf/documentos-pdf';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { Modal } from 'src/app/shared/modal/modal';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { CuotaFactura, Factura } from '../facturas/factura';
import { FacturasRepositorio } from '../facturas/facturas-repositorio';
import { unirMeses } from '../cuotas';
import { FiltrosRecibo, Recibo, mesesRecibo } from './recibo';
import { ReciboFormulario } from './recibo-formulario/recibo-formulario';
import { RecibosFiltros } from './recibos-filtros/recibos-filtros';
import { RecibosStore } from './recibos-store';
import { RecibosTabla } from './recibos-tabla/recibos-tabla';

interface DetalleFactura {
  factura: Factura | null;
  cuotas: CuotaFactura[];
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

  protected readonly facturas = toSignal(this.facturasRepo.opciones().pipe(catchError(() => of<OpcionCatalogo[]>([]))), {
    initialValue: [],
  });

  /** Factura elegida en el formulario y sus cuotas (sin contar el recibo que se edita). */
  protected readonly facturaFormulario = signal('');
  private readonly consultaFactura = computed(() => ({ id: this.facturaFormulario(), sinRecibo: this.seleccionado()?.id }));
  protected readonly detalleFactura = toSignal(
    toObservable(this.consultaFactura).pipe(
      switchMap(({ id, sinRecibo }) =>
        id
          ? forkJoin([this.facturasRepo.obtener(id), this.facturasRepo.cuotas(id, sinRecibo)]).pipe(
              map(([factura, cuotas]): DetalleFactura => ({ factura, cuotas })),
              catchError(() => of<DetalleFactura>({ factura: null, cuotas: [] })),
            )
          : of<DetalleFactura>({ factura: null, cuotas: [] }),
      ),
    ),
    { initialValue: { factura: null, cuotas: [] } as DetalleFactura },
  );

  protected describir(r: Recibo): string {
    return `el recibo ${r.numero} (${r.nombreEstudiante}, ${unirMeses(mesesRecibo(r).map((m) => m.periodo)) || nombrePeriodo(r.periodo, true)})`;
  }
}
