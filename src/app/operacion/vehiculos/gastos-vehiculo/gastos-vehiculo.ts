import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApexAxisChartSeries, ApexChart, ApexNonAxisChartSeries, NgApexchartsModule } from 'ng-apexcharts';
import { catchError, firstValueFrom, of } from 'rxjs';
import { COLORES_TEMA, TemaApp } from 'src/app/core/tema';
import { AccionesFormulario } from 'src/app/shared/acciones-formulario/acciones-formulario';
import { CambiosDatos } from 'src/app/shared/crud/cambios-datos';
import { DatosRegistro, mensajeDeError } from 'src/app/shared/crud/crud';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { descargarCsv } from 'src/app/shared/exportar/csv';
import { fechaCorta, nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { TAMANOS_PAGINA } from 'src/app/shared/crud/crud-store';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { VehiculosRepositorio } from '../vehiculos-repositorio';
import { GastoFormulario } from './gasto-formulario';
import {
  FILTROS_GASTO_VACIOS,
  FiltrosGasto,
  GastoVehiculo,
  RANGOS_GASTOS,
  RangoGastos,
  ResumenGastos,
  TIPOS_GASTO,
  TipoGasto,
  fechasDeRango,
  iconoTipoGasto,
  nombreTipoGasto,
} from './gasto-vehiculo';
import { GastosVehiculoRepositorio } from './gastos-vehiculo-repositorio';

const pesosCortos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 });
const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/**
 * Gastos de la flota (Operación › Vehículos › Gastos): tablero del periodo (total, promedio mensual, combustible y
 * galones, costo por km y rendimiento; gráfico por mes con la parte de combustible y reparto por tipo; ranking por
 * vehículo cuando se ven todos) e historial paginado con registro, edición, borrado y exportación a CSV.
 */
@Component({
  selector: 'app-gastos-vehiculo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DecimalPipe, FormsModule, NgApexchartsModule, Modal, AccionesFormulario, DialogoConfirmacion, Paginacion, SelectorBusqueda, GastoFormulario],
  templateUrl: './gastos-vehiculo.html',
})
export class GastosVehiculo {
  readonly abierto = model(false);
  /** Vehículo con el que abre (`''` = toda la flota). */
  readonly vehiculoId = input('');

  private readonly repositorio = inject(GastosVehiculoRepositorio);
  private readonly vehiculosRepo = inject(VehiculosRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly cambios = inject(CambiosDatos);
  private readonly temaApp = inject(TemaApp);

  protected readonly vehiculos = toSignal(this.vehiculosRepo.opciones().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly tipos = TIPOS_GASTO.map((t) => ({ id: t.id, nombre: t.nombre }));
  protected readonly rangos = RANGOS_GASTOS.map((r) => ({ id: r.id, nombre: r.nombre }));
  protected readonly nombreTipo = nombreTipoGasto;
  protected readonly iconoTipo = iconoTipoGasto;
  protected readonly fechaCorta = fechaCorta;

  protected readonly vehiculo = signal('');
  protected readonly tipo = signal<TipoGasto | ''>('');
  protected readonly rango = signal<RangoGastos>('SEIS_MESES');
  protected readonly pagina = signal(1);
  protected readonly tamano = signal<number>(TAMANOS_PAGINA[0]);

  protected readonly filtros = computed<FiltrosGasto>(() => ({
    ...FILTROS_GASTO_VACIOS,
    vehiculoId: this.vehiculo(),
    tipo: this.tipo(),
    ...fechasDeRango(this.rango()),
  }));

  protected readonly resumen = signal<ResumenGastos | null>(null);
  protected readonly gastos = signal<GastoVehiculo[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.tamano())));

  // Formulario (modal encima)
  protected readonly formularioAbierto = signal(false);
  protected readonly editando = signal<GastoVehiculo | null>(null);
  protected readonly guardando = signal(false);
  protected readonly borrando = signal<GastoVehiculo | null>(null);
  protected readonly confirmacionAbierta = signal(false);

  protected readonly nombreVehiculo = computed(() => this.vehiculos().find((v) => v.id === this.vehiculo())?.nombre ?? '');
  protected readonly subtitulo = computed(() => {
    const rango = RANGOS_GASTOS.find((r) => r.id === this.rango())?.nombre ?? '';
    return `${this.nombreVehiculo() || 'Toda la flota'} · ${rango}`;
  });

  protected readonly graficoMeses = computed(() => {
    const r = this.resumen();
    if (!r || r.porMes.length === 0) return null;
    const c = COLORES_TEMA[this.temaApp.tema()];
    return {
      series: [
        { name: 'Combustible', data: r.porMes.map((m) => m.combustible) },
        { name: 'Otros gastos', data: r.porMes.map((m) => m.total - m.combustible) },
      ] as ApexAxisChartSeries,
      chart: { type: 'bar', height: 260, stacked: true, toolbar: { show: false }, background: 'transparent', foreColor: c.texto, fontFamily: 'inherit' } as ApexChart,
      xaxis: { categories: r.porMes.map((m) => nombrePeriodo(m.periodo)), axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { formatter: (v: number) => pesosCortos.format(v) } },
      grid: { borderColor: c.rejilla, strokeDashArray: 4 },
      tooltip: { theme: this.temaApp.tema() === 'CLARO' ? 'light' : 'dark', y: { formatter: (v: number) => pesos.format(v) } },
      colors: [c.serie[0], c.serie[1]],
      legend: { position: 'top' as const, labels: { colors: c.texto } },
      dataLabels: { enabled: false },
      plotOptions: { bar: { borderRadius: 3, columnWidth: '55%' } },
    };
  });

  protected readonly graficoTipos = computed(() => {
    const r = this.resumen();
    if (!r || r.porTipo.length === 0) return null;
    const c = COLORES_TEMA[this.temaApp.tema()];
    const principales = r.porTipo.slice(0, 5);
    const resto = r.porTipo.slice(5).reduce((s, t) => s + t.total, 0);
    return {
      series: [...principales.map((t) => t.total), ...(resto ? [resto] : [])] as ApexNonAxisChartSeries,
      labels: [...principales.map((t) => nombreTipoGasto(t.tipo)), ...(resto ? ['Otros'] : [])],
      chart: { type: 'donut', height: 260, background: 'transparent', foreColor: c.texto, fontFamily: 'inherit' } as ApexChart,
      colors: c.serie,
      legend: { position: 'bottom' as const, labels: { colors: c.texto } },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      tooltip: { theme: this.temaApp.tema() === 'CLARO' ? 'light' : 'dark', y: { formatter: (v: number) => pesos.format(v) } },
      plotOptions: { pie: { donut: { size: '62%' } } },
    };
  });

  constructor() {
    // Al abrir, toma el vehículo con el que se llamó.
    effect(() => {
      if (!this.abierto()) return;
      const id = this.vehiculoId();
      untracked(() => {
        this.vehiculo.set(id);
        this.pagina.set(1);
      });
    });
    effect(() => {
      if (!this.abierto()) return;
      const filtros = this.filtros();
      const pagina = this.pagina();
      const tamano = this.tamano();
      untracked(() => void this.cargar(filtros, pagina, tamano));
    });
  }

  protected cambiarFiltro(accion: () => void): void {
    accion();
    this.pagina.set(1);
  }

  protected recargar(): void {
    void this.cargar(this.filtros(), this.pagina(), this.tamano());
  }

  private async cargar(filtros: FiltrosGasto, pagina: number, tamano: number): Promise<void> {
    this.cargando.set(true);
    try {
      const [resumen, lista] = await Promise.all([
        firstValueFrom(this.repositorio.resumen(filtros)),
        firstValueFrom(this.repositorio.listar(filtros, { pagina, tamano })),
      ]);
      this.resumen.set(resumen);
      this.gastos.set(lista.items);
      this.total.set(lista.total);
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nuevo(): void {
    this.editando.set(null);
    this.formularioAbierto.set(true);
  }

  protected async editar(g: GastoVehiculo): Promise<void> {
    try {
      this.editando.set(await firstValueFrom(this.repositorio.obtener(g.id)));
      this.formularioAbierto.set(true);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    }
  }

  protected async guardar(datos: DatosRegistro<GastoVehiculo>): Promise<void> {
    const actual = this.editando();
    this.guardando.set(true);
    try {
      await firstValueFrom(actual ? this.repositorio.actualizar(actual.id, datos) : this.repositorio.crear(datos));
      this.avisos.exito(actual ? 'Gasto actualizado.' : 'Gasto registrado.');
      this.formularioAbierto.set(false);
      this.cambios.notificar();
      this.recargar();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected pedirEliminar(g: GastoVehiculo): void {
    this.borrando.set(g);
    this.confirmacionAbierta.set(true);
  }

  protected mensajeEliminar(): string {
    const g = this.borrando();
    return g ? `¿Eliminar el gasto de ${nombreTipoGasto(g.tipo).toLowerCase()} del ${fechaCorta(g.fecha)} por ${pesos.format(g.valor)}?` : '';
  }

  protected async confirmarEliminar(): Promise<void> {
    const g = this.borrando();
    if (!g) return;
    this.guardando.set(true);
    try {
      await firstValueFrom(this.repositorio.eliminar(g.id));
      this.avisos.exito('Gasto eliminado.');
      this.confirmacionAbierta.set(false);
      if (this.gastos().length === 1 && this.pagina() > 1) this.pagina.update((p) => p - 1);
      else this.recargar();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async exportar(): Promise<void> {
    try {
      const todos = await firstValueFrom(this.repositorio.listar(this.filtros(), { pagina: 1, tamano: 1000 }));
      descargarCsv(
        'gastos-vehiculos.csv',
        ['Fecha', 'Vehículo', 'Tipo', 'Valor', 'Galones/cantidad', 'Kilometraje', 'Proveedor', 'Referencia', 'Descripción'],
        todos.items.map((g) => [g.fecha, g.vehiculo, nombreTipoGasto(g.tipo), g.valor, g.cantidad ?? '', g.kilometraje ?? '', g.proveedor, g.referencia, g.descripcion]),
      );
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    }
  }

  protected porcentaje(valor: number): number {
    const max = this.resumen()?.porVehiculo[0]?.total ?? 0;
    return max ? Math.round((valor / max) * 100) : 0;
  }
}
