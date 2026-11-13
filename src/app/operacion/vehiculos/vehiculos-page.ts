import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { PaginaCrud } from 'src/app/shared/crud/pagina-crud';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { Modal } from 'src/app/shared/modal/modal';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { FiltrosVehiculo, Vehiculo } from './vehiculo';
import { VehiculoFormulario } from './vehiculo-formulario/vehiculo-formulario';
import { VehiculosFiltros } from './vehiculos-filtros/vehiculos-filtros';
import { VehiculosStore } from './vehiculos-store';
import { VehiculosTabla } from './vehiculos-tabla/vehiculos-tabla';
import { DocumentosVehiculo } from './documentos-vehiculo/documentos-vehiculo';
import { firstValueFrom } from 'rxjs';
import { VehiculosRepositorio } from './vehiculos-repositorio';

@Component({
  selector: 'app-vehiculos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VehiculosFiltros, VehiculosTabla, VehiculoFormulario, DocumentosVehiculo, EncabezadoListado, AccionesFormulario, Modal, DialogoConfirmacion, Paginacion],
  providers: [VehiculosStore],
  templateUrl: './vehiculos-page.html',
})
export default class VehiculosPage extends PaginaCrud<Vehiculo, FiltrosVehiculo> {
  protected readonly store = inject(VehiculosStore);
  protected readonly titulos = { crear: 'Nuevo vehículo', editar: 'Editar vehículo', consultar: 'Detalle del vehículo' };

  private readonly repositorio = inject(VehiculosRepositorio);

  /** Cambió el historial: el vencimiento del vehículo se sincronizó con el registro más reciente. */
  protected async documentosCambiaron(): Promise<void> {
    const v = this.seleccionado();
    this.store.recargar();
    if (!v) return;
    try {
      this.seleccionado.set(await firstValueFrom(this.repositorio.obtener(v.id)));
    } catch {
      // La tabla ya se recargó; el detalle conserva lo que tenía.
    }
  }

  protected describir(v: Vehiculo): string {
    return `el vehículo ${v.placa} (interno ${v.numeroInterno})`;
  }
}
