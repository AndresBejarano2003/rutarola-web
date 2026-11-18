import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
import { GastosVehiculo } from './gastos-vehiculo/gastos-vehiculo';
import { NovedadesVehiculo } from './novedades-vehiculo/novedades-vehiculo';
import { NovedadesVehiculoRepositorio } from './novedades-vehiculo/novedades-vehiculo-repositorio';
import { VehiculosRepositorio } from './vehiculos-repositorio';

@Component({
  selector: 'app-vehiculos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VehiculosFiltros, VehiculosTabla, VehiculoFormulario, DocumentosVehiculo, NovedadesVehiculo, GastosVehiculo, EncabezadoListado, AccionesFormulario, Modal, DialogoConfirmacion, Paginacion],
  providers: [VehiculosStore],
  templateUrl: './vehiculos-page.html',
})
export default class VehiculosPage extends PaginaCrud<Vehiculo, FiltrosVehiculo> {
  protected readonly store = inject(VehiculosStore);
  protected readonly titulos = { crear: 'Nuevo vehículo', editar: 'Editar vehículo', consultar: 'Detalle del vehículo' };

  private readonly repositorio = inject(VehiculosRepositorio);
  private readonly novedades = inject(NovedadesVehiculoRepositorio);
  private readonly rutaActual = inject(ActivatedRoute);

  protected readonly gastosAbierto = signal(false);
  protected readonly gastosVehiculo = signal('');
  protected readonly novedadesAbiertas = signal<ReadonlyMap<string, number>>(new Map());
  /** `?novedad=<id>` (enlace de la campana): abre el vehículo con esa novedad resaltada. */
  protected readonly novedadResaltada = signal<string | null>(null);

  override ngOnInit(): void {
    super.ngOnInit();
    void this.cargarNovedades();
    const novedad = this.rutaActual.snapshot.queryParamMap.get('novedad');
    if (novedad) void this.abrirNovedad(novedad);
  }

  protected abrirGastos(vehiculoId: string): void {
    this.gastosVehiculo.set(vehiculoId);
    this.gastosAbierto.set(true);
  }

  protected async cargarNovedades(): Promise<void> {
    try {
      const abiertas = await firstValueFrom(this.novedades.listar({ abiertas: true }));
      const mapa = new Map<string, number>();
      for (const n of abiertas) mapa.set(n.vehiculoId, (mapa.get(n.vehiculoId) ?? 0) + 1);
      this.novedadesAbiertas.set(mapa);
    } catch {
      // El contador es informativo: sin él la tabla sigue funcionando.
    }
  }

  private async abrirNovedad(id: string): Promise<void> {
    try {
      const novedad = await firstValueFrom(this.novedades.obtener(id));
      const vehiculo = await firstValueFrom(this.repositorio.obtener(novedad.vehiculoId));
      this.novedadResaltada.set(id);
      await this.abrir('consultar', vehiculo);
    } catch {
      // La novedad ya no existe: queda el listado.
    }
  }

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
