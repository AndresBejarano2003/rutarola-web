import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { AcudientesRepositorio } from 'src/app/personas/acudientes/acudientes-repositorio';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { PaginaCrud } from 'src/app/shared/crud/pagina-crud';
import { GeneradorPdf } from 'src/app/shared/documentos-pdf/generador-pdf';
import { contenidoFactura } from 'src/app/shared/documentos-pdf/documentos-pdf';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { Modal } from 'src/app/shared/modal/modal';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { Factura, FiltrosFactura } from './factura';
import { FacturaFormulario } from './factura-formulario/factura-formulario';
import { FacturasFiltros } from './facturas-filtros/facturas-filtros';
import { FacturasStore } from './facturas-store';
import { FacturasTabla } from './facturas-tabla/facturas-tabla';

@Component({
  selector: 'app-facturas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FacturasFiltros, FacturasTabla, FacturaFormulario, EncabezadoListado, AccionesFormulario, Modal, DialogoConfirmacion, Paginacion],
  providers: [FacturasStore],
  templateUrl: './facturas-page.html',
})
export default class FacturasPage extends PaginaCrud<Factura, FiltrosFactura> {
  protected readonly store = inject(FacturasStore);
  private readonly pdf = inject(GeneradorPdf);

  /** Abre "Imprimir / Guardar como PDF" con el formato de la empresa (Inicio › Configuración › Documentos PDF). */
  protected descargarPdf(f: Factura): void {
    void this.pdf.descargar(contenidoFactura(f));
  }
  protected readonly titulos = { crear: 'Nueva factura', editar: 'Editar factura', consultar: 'Detalle de la factura' };

  private readonly estudiantes = inject(EstudiantesRepositorio);
  protected readonly acudientes = toSignal(inject(AcudientesRepositorio).opciones().pipe(catchError(() => of<OpcionCatalogo[]>([]))), {
    initialValue: [],
  });

  protected readonly acudienteFormulario = signal('');
  protected readonly estudiantesAcudiente = toSignal(
    toObservable(this.acudienteFormulario).pipe(
      switchMap((acudienteId) => (acudienteId ? this.estudiantes.opciones({ acudienteId }).pipe(catchError(() => of([]))) : of([]))),
    ),
    { initialValue: [] },
  );

  protected describir(f: Factura): string {
    return `la factura ${f.numero} de ${f.nombreEstudiante}`;
  }
}
