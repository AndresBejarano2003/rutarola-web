import { AvisosDelDia } from '../avisos-ausencia/avisos-del-dia';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { OpcionCatalogo, aMapa } from 'src/app/shared/catalogos/catalogos';
import { PaginaCrud } from 'src/app/shared/crud/pagina-crud';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { Modal } from 'src/app/shared/modal/modal';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { RutasRepositorio } from '../rutas/rutas-repositorio';
import { VehiculosRepositorio } from '../vehiculos/vehiculos-repositorio';
import { Asignacion, FiltrosAsignacion } from './asignacion';
import { AsignacionFormulario, OpcionesAsignacion } from './asignacion-formulario/asignacion-formulario';
import { AsignacionesFiltros } from './asignaciones-filtros/asignaciones-filtros';
import { AsignacionesStore } from './asignaciones-store';
import { AsignacionesTabla, NombresAsignacion } from './asignaciones-tabla/asignaciones-tabla';

const opcionesSeguras = (fuente: ReturnType<RutasRepositorio['opciones']>) =>
  toSignal(fuente.pipe(catchError(() => of<OpcionCatalogo[]>([]))), { initialValue: [] });

@Component({
  selector: 'app-asignaciones-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvisosDelDia, AsignacionesFiltros, AsignacionesTabla, AsignacionFormulario, EncabezadoListado, AccionesFormulario, Modal, DialogoConfirmacion, Paginacion],
  providers: [AsignacionesStore],
  templateUrl: './asignaciones-page.html',
})
export default class AsignacionesPage extends PaginaCrud<Asignacion, FiltrosAsignacion> {
  protected readonly store = inject(AsignacionesStore);
  protected readonly titulos = { crear: 'Nueva asignación', editar: 'Editar asignación', consultar: 'Detalle de la asignación' };

  private readonly empleados = inject(EmpleadosRepositorio);
  private readonly rutas = opcionesSeguras(inject(RutasRepositorio).opciones());
  private readonly vehiculos = opcionesSeguras(inject(VehiculosRepositorio).opciones());
  private readonly conductores = opcionesSeguras(this.empleados.opciones({ tipoEmpleado: 'CONDUCTOR' }));
  private readonly monitoras = opcionesSeguras(this.empleados.opciones({ tipoEmpleado: 'MONITORA' }));

  protected readonly personal = computed(() => [...this.conductores(), ...this.monitoras()]);
  protected readonly opciones = computed<OpcionesAsignacion>(() => ({
    rutas: this.rutas(),
    vehiculos: this.vehiculos(),
    conductores: this.conductores(),
    monitoras: this.monitoras(),
  }));
  protected readonly nombres = computed<NombresAsignacion>(() => ({
    rutas: aMapa(this.rutas()),
    vehiculos: new Map(this.vehiculos().map((v) => [v.id, v.nombre.split(' · ')[0]])),
    empleados: aMapa(this.personal()),
  }));

  protected describir(a: Asignacion): string {
    return `la asignación de la ruta ${this.nombres().rutas.get(a.rutaId) ?? ''}`.trim();
  }
}
