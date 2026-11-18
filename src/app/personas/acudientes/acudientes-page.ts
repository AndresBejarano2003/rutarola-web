import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { DatosRegistro } from 'src/app/shared/crud/crud';
import { PaginaCrud } from 'src/app/shared/crud/pagina-crud';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { Modal } from 'src/app/shared/modal/modal';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { nombreCompleto } from '../compartido/persona';
import { Acudiente, FiltrosAcudiente } from './acudiente';
import { AcudienteFormulario } from './acudiente-formulario/acudiente-formulario';
import { AcudientesFiltros } from './acudientes-filtros/acudientes-filtros';
import { AcudientesStore } from './acudientes-store';
import { AcudientesTabla } from './acudientes-tabla/acudientes-tabla';
import { EstudiantesACargo } from './estudiantes-a-cargo/estudiantes-a-cargo';

@Component({
  selector: 'app-acudientes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AcudientesFiltros,
    AcudientesTabla,
    AcudienteFormulario,
    EstudiantesACargo,
    EncabezadoListado,
    AccionesFormulario,
    Modal,
    DialogoConfirmacion,
    Paginacion,
  ],
  providers: [AcudientesStore],
  templateUrl: './acudientes-page.html',
})
export default class AcudientesPage extends PaginaCrud<Acudiente, FiltrosAcudiente> {
  protected readonly store = inject(AcudientesStore);
  protected readonly titulos = { crear: 'Nuevo acudiente', editar: 'Editar acudiente', consultar: 'Detalle del acudiente' };

  // Modal "Estudiantes a cargo"
  protected readonly estudiantesAbierto = signal(false);
  protected readonly acudienteEstudiantes = signal<Acudiente | null>(null);
  protected readonly nombreAcudienteEstudiantes = computed(() => {
    const acudiente = this.acudienteEstudiantes();
    return acudiente ? nombreCompleto(acudiente) : '';
  });

  protected readonly describirNombre = nombreCompleto;

  /**
   * Al registrar un acudiente el modal sigue abierto con su detalle, para agregarle sus estudiantes sin salir
   * (luego se cierra con "Cerrar"). Editar cierra el modal como siempre.
   */
  protected override async guardar(datos: DatosRegistro<Acudiente>): Promise<void> {
    if (this.modo() !== 'crear') {
      return super.guardar(datos);
    }
    const creado = await this.store.crear(datos);
    if (creado) {
      this.seleccionado.set(creado);
      this.modo.set('consultar');
    }
  }

  protected describir(a: Acudiente): string {
    return `${nombreCompleto(a)} (${a.tipoDocumento} ${a.numeroDocumento})`;
  }

  protected verEstudiantes(acudiente: Acudiente): void {
    this.acudienteEstudiantes.set(acudiente);
    this.estudiantesAbierto.set(true);
  }
}
