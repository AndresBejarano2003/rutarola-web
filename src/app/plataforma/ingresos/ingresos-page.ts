import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { firstValueFrom } from 'rxjs';
import { COLORES_TEMA, TemaApp } from 'src/app/core/tema';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { descargarCsv } from 'src/app/shared/exportar/csv';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { PaginacionLocal } from 'src/app/shared/paginacion/paginacion-local';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { hoyColombia, nombrePlan } from 'src/app/sistema/membresias/suscripcion';
import {
  DIAS_MAXIMOS_INGRESOS,
  GrupoIngresos,
  IngresosPlataforma,
  PRESETS_INGRESOS,
  PresetIngresos,
  diasDelRango,
  rangoPreset,
  variacion,
} from './ingresos';
import { IngresosRepositorio } from './ingresos-repositorio';

const pesosCortos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 });
const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-11-05" → "5 nov"; "2026-11" → "nov 2026". */
function etiquetaPeriodo(periodo: string): string {
  const [y, m, d] = periodo.split('-').map(Number);
  return d ? `${d} ${MESES[m - 1]}` : `${MESES[m - 1]} ${y}`;
}

/**
 * Plataforma › Ingresos (SUPER_ADMIN, inicio de la plataforma): cuánto entró por planes pagados en el periodo elegido
 * (este mes, mes pasado, últimos 3/6/12 meses, este año, año pasado o un rango propio de hasta 3 años), comparado con
 * el periodo anterior de la misma duración, el recurrente mensual de los planes vigentes hoy, la serie por día o mes,
 * el reparto por plan, periodo y medio de pago, las empresas que más pagaron y el detalle exportable a CSV.
 */
@Component({
  selector: 'app-ingresos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, FormsModule, NgApexchartsModule, Paginacion, SelectorBusqueda],
  templateUrl: './ingresos-page.html',
})
export default class IngresosPage {
  private readonly repositorio = inject(IngresosRepositorio);
  private readonly temaApp = inject(TemaApp);

  protected readonly presets = PRESETS_INGRESOS;
  protected readonly preset = signal<PresetIngresos>('ESTE_MES');
  protected readonly desde = signal(rangoPreset('ESTE_MES', hoyColombia()).desde);
  protected readonly hasta = signal(hoyColombia());
  protected readonly datos = signal<IngresosPlataforma | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly nombrePlan = nombrePlan;

  protected readonly rangoInvalido = computed(() => {
    const d = this.desde();
    const h = this.hasta();
    if (!d || !h) return 'Elige las dos fechas.';
    if (h < d) return 'La fecha final debe ser igual o posterior a la inicial.';
    if (diasDelRango(d, h) > DIAS_MAXIMOS_INGRESOS) return 'Elige un rango de máximo 3 años.';
    return null;
  });

  protected readonly cambio = computed(() => {
    const d = this.datos();
    return d ? variacion(d.total, d.totalAnterior) : null;
  });

  protected readonly detalle = computed(() => this.datos()?.detalle ?? []);
  protected readonly paginacion = new PaginacionLocal(this.detalle);

  protected readonly grafico = computed(() => {
    const d = this.datos();
    if (!d) return null;
    const colores = COLORES_TEMA[this.temaApp.tema()];
    const porDia = d.agrupacion === 'DIA';
    return {
      series: [{ name: 'Ingresos', data: d.serie.map((p) => p.total) }] as ApexAxisChartSeries,
      chart: {
        type: porDia ? 'area' : 'bar',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        background: 'transparent',
        foreColor: colores.texto,
        fontFamily: 'inherit',
      } as ApexChart,
      dataLabels: { enabled: false } as ApexDataLabels,
      stroke: { curve: 'smooth', width: porDia ? 2 : 0 } as ApexStroke,
      fill: (porDia ? { type: 'gradient', gradient: { opacityFrom: 0.45, opacityTo: 0.05 } } : { opacity: 1 }) as ApexFill,
      xaxis: {
        categories: d.serie.map((p) => etiquetaPeriodo(p.periodo)),
        tickAmount: porDia ? Math.min(10, d.serie.length) : undefined,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { rotate: 0, hideOverlappingLabels: true },
      } as ApexXAxis,
      yaxis: { labels: { formatter: (v: number) => pesosCortos.format(v) } } as ApexYAxis,
      grid: { borderColor: colores.rejilla, strokeDashArray: 4 } as ApexGrid,
      tooltip: {
        theme: this.temaApp.tema() === 'CLARO' ? 'light' : 'dark',
        y: { formatter: (v: number, o?: { dataPointIndex: number }) => `${pesos.format(v)} · ${d.serie[o?.dataPointIndex ?? 0]?.pagos ?? 0} pago(s)` },
      } as ApexTooltip,
      colors: [colores.serie[0]],
    };
  });

  constructor() {
    effect(() => {
      const d = this.desde();
      const h = this.hasta();
      if (this.rangoInvalido()) return;
      untracked(() => void this.cargar(d, h));
    });
  }

  protected elegirPreset(id: string | null): void {
    const preset = (id || 'ESTE_MES') as PresetIngresos;
    this.preset.set(preset);
    if (preset === 'PERSONALIZADO') return;
    const r = rangoPreset(preset, hoyColombia());
    this.desde.set(r.desde);
    this.hasta.set(r.hasta);
  }

  protected cambiarFecha(campo: 'desde' | 'hasta', valor: string): void {
    this.preset.set('PERSONALIZADO');
    this[campo].set(valor);
  }

  protected async cargar(desde = this.desde(), hasta = this.hasta()): Promise<void> {
    this.cargando.set(true);
    try {
      this.datos.set(await firstValueFrom(this.repositorio.obtener(desde, hasta)));
      this.paginacion.reiniciar();
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Ancho de la barra frente al mayor del grupo. */
  protected porcentaje(g: GrupoIngresos, total: number): number {
    return total > 0 ? Math.round((g.total / total) * 100) : 0;
  }

  protected exportar(): void {
    const d = this.datos();
    if (!d) return;
    descargarCsv(
      `ingresos-${d.desde}-a-${d.hasta}`,
      ['Fecha', 'Empresa', 'Plan', 'Periodo', 'Valor', 'Descuento', 'Medio', 'Referencia', 'Código'],
      d.detalle.map((p) => [
        new Date(p.fecha).toLocaleDateString('es-CO'),
        p.empresa,
        nombrePlan(p.plan),
        p.periodo === 'ANUAL' ? 'Anual' : 'Mensual',
        p.valor,
        p.descuento,
        p.metodo,
        p.referencia,
        p.codigoPromocional,
      ]),
    );
  }
}
