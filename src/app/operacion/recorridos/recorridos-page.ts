import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ESTADOS_PARADA, EstadoRecorrido, Recorrido, TRAYECTOS, Trayecto, contarParadas, nombreAusencia } from 'src/app/ruta-del-dia/recorrido';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { EncabezadoListado } from 'src/app/shared/encabezado-listado/encabezado-listado';
import { EstadoVacio } from 'src/app/shared/estado-vacio/estado-vacio';
import { descargarCsv } from 'src/app/shared/exportar/csv';
import { fechaCorta, fechaIso } from 'src/app/shared/fechas/fechas';
import { emitirEnVivo } from 'src/app/shared/formularios/formularios';
import { Modal } from 'src/app/shared/modal/modal';
import { MapaTrayecto } from './mapa-trayecto/mapa-trayecto';
import { PlanEmpresa } from 'src/app/core/plan-empresa';
import { computed } from '@angular/core';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { PanelFiltros } from 'src/app/shared/panel-filtros/panel-filtros';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { RutasRepositorio } from '../rutas/rutas-repositorio';
import {
  ESTADOS_RECORRIDO,
  FILTROS_RECORRIDO_VACIOS,
  FiltrosRecorrido,
  NOVEDADES_RECORRIDO,
  NovedadRecorrido,
  duracionMinutos,
  textoDuracion,
} from './historial-recorridos';
import { HistorialRecorridosRepositorio } from './historial-recorridos-repositorio';
import { HistorialRecorridosStore } from './historial-recorridos-store';

/**
 * Historial (solo lectura) de los recorridos que hacen conductores y monitoras desde la
 * ruta del día: quién, cuándo, cuánto duró y qué pasó con cada estudiante.
 */
@Component({
  selector: 'app-recorridos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFiltros, ReactiveFormsModule, RouterLink, SelectorBusqueda, EncabezadoListado, Paginacion, Modal, EstadoVacio, MapaTrayecto],
  providers: [HistorialRecorridosStore],
  templateUrl: './recorridos-page.html',
})
export default class RecorridosPage implements OnInit {
  protected readonly store = inject(HistorialRecorridosStore);
  private readonly repositorio = inject(HistorialRecorridosRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly plan = inject(PlanEmpresa, { optional: true });
  /** El trayecto en el mapa depende del GPS en vivo del plan. */
  protected readonly gpsDisponible = computed(() => this.plan?.tiene('GPS_EN_VIVO') ?? true);

  protected readonly rutas = toSignal(inject(RutasRepositorio).opciones(), { initialValue: [] });
  protected readonly trayectos = TRAYECTOS;
  protected readonly estadosRecorrido = ESTADOS_RECORRIDO;
  protected readonly novedades = NOVEDADES_RECORRIDO;
  protected readonly estadosParada = ESTADOS_PARADA;
  protected readonly nombreAusencia = nombreAusencia;
  protected readonly fechaCorta = fechaCorta;
  protected readonly contar = contarParadas;
  protected readonly hoy = fechaIso();

  protected readonly filtros = inject(NonNullableFormBuilder).group({
    texto: FILTROS_RECORRIDO_VACIOS.texto,
    desde: FILTROS_RECORRIDO_VACIOS.desde,
    hasta: FILTROS_RECORRIDO_VACIOS.hasta,
    rutaId: FILTROS_RECORRIDO_VACIOS.rutaId,
    trayecto: FILTROS_RECORRIDO_VACIOS.trayecto as Trayecto | '',
    estado: FILTROS_RECORRIDO_VACIOS.estado as EstadoRecorrido | '',
    novedad: FILTROS_RECORRIDO_VACIOS.novedad as NovedadRecorrido | '',
  });

  protected readonly detalleAbierto = signal(false);
  protected readonly detalle = signal<Recorrido | null>(null);
  protected readonly exportando = signal(false);

  constructor() {
    emitirEnVivo<FiltrosRecorrido>(this.filtros, { emit: (f) => this.store.buscar(f) });
  }

  ngOnInit(): void {
    this.store.recargar();
  }

  protected consultar(r: Recorrido): void {
    this.detalle.set(r);
    this.detalleAbierto.set(true);
  }

  protected nombreTrayecto(t: Trayecto): string {
    return TRAYECTOS.find((x) => x.id === t)?.nombre ?? t;
  }

  protected hora(iso: string | null): string {
    return iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';
  }

  protected duracion(r: Recorrido): string {
    return textoDuracion(duracionMinutos(r));
  }

  /** Exporta TODOS los recorridos que cumplen los filtros (no solo la página visible). */
  protected async exportar(): Promise<void> {
    this.exportando.set(true);
    try {
      const { items } = await firstValueFrom(this.repositorio.listar(this.store.filtros(), SIN_PAGINAR));
      descargarCsv(
        `recorridos-${this.hoy}.csv`,
        ['Fecha', 'Ruta', 'Jornada', 'Colegio', 'Trayecto', 'Vehículo', 'Conductor', 'Monitora', 'Inicio', 'Fin', 'Duración (min)',
          'Estudiantes', 'Entregados', 'No asistieron', 'Estado', 'Observaciones'],
        items.map((r) => {
          const c = contarParadas(r.paradas);
          return [r.fecha, r.ruta, r.jornada, r.colegio, this.nombreTrayecto(r.trayecto), r.vehiculo, r.conductor, r.monitora,
            this.hora(r.inicio), this.hora(r.fin), r.fin ? duracionMinutos(r) : '', c.total, c.entregados, c.ausentes,
            ESTADOS_RECORRIDO.find((e) => e.id === r.estado)?.nombre ?? r.estado, r.observaciones];
        }),
      );
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
    } finally {
      this.exportando.set(false);
    }
  }
}
