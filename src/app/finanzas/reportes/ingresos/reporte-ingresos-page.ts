import { PanelFiltros } from 'src/app/shared/panel-filtros/panel-filtros';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApexAxisChartSeries, ApexChart, ApexDataLabels, ApexPlotOptions, ApexTooltip, ApexXAxis, ApexYAxis, NgApexchartsModule } from 'ng-apexcharts';
import { descargarCsv } from 'src/app/shared/exportar/csv';
import { emitirEnVivo } from 'src/app/shared/formularios/formularios';
import { fechaCorta, nombrePeriodo, periodoDe, sumarMeses } from 'src/app/shared/fechas/fechas';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { PaginacionLocal } from 'src/app/shared/paginacion/paginacion-local';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { MEDIOS_PAGO, MedioPago } from '../../recibos/recibo';
import { reporteEnVivo } from '../estado-reporte';
import { FiltrosIngresos, ReporteIngresos } from '../reportes';
import { ReportesRepositorio } from '../reportes-repositorio';

const VACIO: ReporteIngresos = { total: 0, cantidad: 0, promedio: 0, porMes: [], porMedio: [], recibos: [] };
const formatoPesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

@Component({
  selector: 'app-reporte-ingresos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFiltros, ReactiveFormsModule, SelectorBusqueda, NgApexchartsModule, Paginacion, CurrencyPipe],
  templateUrl: './reporte-ingresos-page.html',
})
export default class ReporteIngresosPage {
  private readonly reportes = inject(ReportesRepositorio);
  protected readonly medios = MEDIOS_PAGO;
  protected readonly nombrePeriodo = nombrePeriodo;
  protected readonly fechaCorta = fechaCorta;

  protected readonly form = inject(NonNullableFormBuilder).group({
    desde: sumarMeses(periodoDe(), -11),
    hasta: periodoDe(),
    medioPago: '' as MedioPago | '',
  });
  protected readonly filtros = signal<FiltrosIngresos>(this.form.getRawValue());
  protected readonly rangoInvalido = computed(() => !!this.filtros().desde && !!this.filtros().hasta && this.filtros().desde > this.filtros().hasta);

  protected readonly reporte = reporteEnVivo(this.filtros, (f) => this.reportes.ingresos(f), VACIO);
  protected readonly paginacion = new PaginacionLocal(computed(() => this.reporte().datos.recibos));

  protected readonly grafico = computed(() => {
    const porMes = this.reporte().datos.porMes;
    return {
      series: [{ name: 'Recaudado', data: porMes.map((m) => m.total) }] as ApexAxisChartSeries,
      chart: { type: 'bar', height: 300, toolbar: { show: false }, background: 'transparent', foreColor: '#d1d5db' } as ApexChart,
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } } as ApexPlotOptions,
      dataLabels: { enabled: false } as ApexDataLabels,
      xaxis: { categories: porMes.map((m) => nombrePeriodo(m.periodo)) } as ApexXAxis,
      yaxis: { labels: { formatter: (v: number) => formatoPesos.format(v) } } as ApexYAxis,
      tooltip: { theme: 'dark', y: { formatter: (v: number) => formatoPesos.format(v) } } as ApexTooltip,
      colors: ['#facc15'],
    };
  });

  protected readonly mediosConDatos = computed(() => {
    const { porMedio, total } = this.reporte().datos;
    return porMedio.map((m) => ({
      ...m,
      nombre: MEDIOS_PAGO.find((x) => x.id === m.medioPago)?.nombre ?? m.medioPago,
      icono: MEDIOS_PAGO.find((x) => x.id === m.medioPago)?.icono ?? 'fa-solid fa-coins',
      porcentaje: total ? Math.round((m.total / total) * 100) : 0,
    }));
  });

  constructor() {
    emitirEnVivo(this.form, { emit: (f: FiltrosIngresos) => this.filtros.set(f) });
    // Página 1 al cambiar los filtros (no en la recarga automática, que conserva la página).
    effect(() => {
      this.filtros();
      untracked(() => this.paginacion.reiniciar());
    });
  }

  protected nombreMedio(id: MedioPago): string {
    return MEDIOS_PAGO.find((m) => m.id === id)?.nombre ?? id;
  }

  protected reintentar(): void {
    this.filtros.set({ ...this.filtros() });
  }

  protected exportar(): void {
    descargarCsv(
      `ingresos-${this.filtros().desde || 'inicio'}-a-${this.filtros().hasta || 'hoy'}`,
      ['Recibo', 'Fecha de pago', 'Factura', 'Acudiente', 'Estudiante', 'Mes pagado', 'Medio de pago', 'Referencia', 'Valor'],
      this.reporte().datos.recibos.map((r) => [
        r.numero,
        r.fechaPago,
        r.numeroFactura,
        r.nombreAcudiente,
        r.nombreEstudiante,
        r.periodo,
        this.nombreMedio(r.medioPago),
        r.referencia,
        r.valor,
      ]),
    );
  }
}
