import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, map, of, switchMap } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { ColegiosRepositorio } from 'src/app/operacion/colegios/colegios-repositorio';
import { FILTROS_ESTUDIANTE_VACIOS } from 'src/app/personas/estudiantes/estudiante';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { fechaIso, nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { AcudientesRepositorio } from 'src/app/personas/acudientes/acudientes-repositorio';
import { EstudiantesRepositorio } from 'src/app/personas/estudiantes/estudiantes-repositorio';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { ESTADOS_COTIZACION, enlaceCorreo, enlaceWhatsapp, facturada, motivoNoFacturar, telefonoWhatsapp } from './cotizacion';
import { CotizacionesRepositorio } from './cotizaciones-repositorio';
import { PaginaCrud } from 'src/app/shared/crud/pagina-crud';
import { GeneradorPdf } from 'src/app/shared/documentos-pdf/generador-pdf';
import { contenidoCotizacion } from 'src/app/shared/documentos-pdf/documentos-pdf';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { Modal } from 'src/app/shared/modal/modal';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { Cotizacion, FiltrosCotizacion } from './cotizacion';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { CotizacionFormulario, EstudianteParaCotizar } from './cotizacion-formulario/cotizacion-formulario';
import { CotizacionesFiltros } from './cotizaciones-filtros/cotizaciones-filtros';
import { CotizacionesStore } from './cotizaciones-store';
import { CotizacionesTabla } from './cotizaciones-tabla/cotizaciones-tabla';

@Component({
  selector: 'app-cotizaciones-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CotizacionesFiltros, CotizacionesTabla, CotizacionFormulario, EncabezadoListado, AccionesFormulario, Modal, DialogoConfirmacion, Paginacion],
  providers: [CotizacionesStore],
  templateUrl: './cotizaciones-page.html',
})
export default class CotizacionesPage extends PaginaCrud<Cotizacion, FiltrosCotizacion> {
  protected readonly store = inject(CotizacionesStore);
  private readonly pdf = inject(GeneradorPdf);

  /** Abre "Imprimir / Guardar como PDF" con el formato de la empresa (Inicio › Configuración › Documentos PDF). */
  protected descargarPdf(f: Cotizacion): void {
    void this.pdf.descargar(contenidoCotizacion(f, ESTADOS_COTIZACION.find((e) => e.id === f.estado)?.nombre ?? f.estado));
  }
  protected readonly titulos = { crear: 'Nueva cotización', editar: 'Editar cotización', consultar: 'Detalle de la cotización' };

  private readonly estudiantes = inject(EstudiantesRepositorio);
  protected readonly acudientes = toSignal(
    inject(AcudientesRepositorio).opciones().pipe(catchError(() => of<OpcionCatalogo[]>([]))),
    { initialValue: [] },
  );

  protected readonly colegios = toSignal(
    inject(ColegiosRepositorio).opciones({ estado: 'ACTIVO' }).pipe(catchError(() => of<OpcionCatalogo[]>([]))),
    { initialValue: [] },
  );

  /** Estudiantes (activos) del acudiente elegido en el formulario, con su colegio. */
  protected readonly acudienteFormulario = signal('');
  protected readonly estudiantesAcudiente = toSignal(
    toObservable(this.acudienteFormulario).pipe(
      switchMap((acudienteId) =>
        acudienteId
          ? this.estudiantes.listar({ ...FILTROS_ESTUDIANTE_VACIOS, acudienteId, estado: 'ACTIVO' }, SIN_PAGINAR).pipe(
              map(({ items }) =>
                items.map((e): EstudianteParaCotizar => ({ id: e.id, nombre: nombreCompleto(e), colegioId: e.colegioId })),
              ),
              catchError(() => of<EstudianteParaCotizar[]>([])),
            )
          : of<EstudianteParaCotizar[]>([]),
      ),
    ),
    { initialValue: [] },
  );

  // --- Enviar y facturar -----------------------------------------------------------------------
  private readonly repositorio = inject(CotizacionesRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly nombreEmpresa = (() => {
    const auth = inject(AuthService);
    return computed(() => auth.sesion()?.empresa?.nombre ?? '');
  })();
  protected readonly facturada = facturada;
  protected readonly confirmarFacturar = signal(false);
  protected readonly facturando = signal(false);

  protected enlaceWhatsapp(c: Cotizacion): string {
    return enlaceWhatsapp(c, this.nombreEmpresa());
  }

  protected enlaceCorreo(c: Cotizacion): string {
    return enlaceCorreo(c, this.nombreEmpresa());
  }

  protected tieneWhatsapp(c: Cotizacion): boolean {
    return !!telefonoWhatsapp(c.telefonoAcudiente);
  }

  protected readonly mensajeFacturar = computed(() => {
    const c = this.seleccionado();
    if (!c) return '';
    const motivo = motivoNoFacturar(c);
    if (motivo) return motivo;
    const n = c.estudiantes.length;
    return `Se aprobará la cotización ${c.numero} y se creará${n === 1 ? '' : 'n'} ${n} factura${n === 1 ? '' : 's'} vigente${n === 1 ? '' : 's'} ` +
      `(una por estudiante, con su valor mensual) de ${nombrePeriodo(c.periodoInicio, true)} a ${nombrePeriodo(c.periodoFin, true)}, emitida${n === 1 ? '' : 's'} hoy. Desde ese momento la cotización queda de solo lectura.`;
  });
  protected nombresFacturas(c: Cotizacion): string {
    return c.facturas.map((f) => f.nombre).join(', ');
  }

  protected readonly puedeFacturar = computed(() => {
    const c = this.seleccionado();
    return !!c && !motivoNoFacturar(c);
  });

  protected async facturar(): Promise<void> {
    const c = this.seleccionado();
    if (!c) return;
    this.facturando.set(true);
    try {
      const { cotizacion, facturas } = await firstValueFrom(this.repositorio.facturar(c.id, fechaIso(), 'Servicio de transporte escolar'));
      this.seleccionado.set(cotizacion);
      this.confirmarFacturar.set(false);
      this.store.recargar();
      this.avisos.exito(`Cotización aprobada: se ${facturas.length === 1 ? 'creó la factura' : `crearon ${facturas.length} facturas`} ${facturas.map((f) => f.numero).join(', ')}.`);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.facturando.set(false);
    }
  }

  protected describir(c: Cotizacion): string {
    return `la cotización ${c.numero} de ${c.nombreAcudiente}`;
  }
}
