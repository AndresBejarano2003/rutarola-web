import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { TemaApp } from 'src/app/core/tema';
import { AuthService } from 'src/app/core/auth';
import { MEDIOS_PAGO, MedioPago } from 'src/app/finanzas/recibos/recibo';
import { CambiosDatos } from 'src/app/shared/crud/cambios-datos';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { diasEntre, fechaCorta, fechaIso, nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { nivel } from '../notificaciones/notificacion-sistema';
import { DIAS_AGENDA, ICONOS_AGENDA, OcupacionRuta, TABLERO_VACIO, Tablero } from './tablero';
import { TableroRepositorio } from './tablero-repositorio';

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const pesosCortos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 });

/** Colores de cada tema (`rutarola` / `rutarola-claro`) para ApexCharts (no lee variables CSS). */
const COLORES_TEMA = {
  OSCURO: {
    texto: '#d1d5db',
    rejilla: '#374151',
    facturado: '#38bdf8',
    recaudado: '#4ade80',
    serie: ['#facc15', '#38bdf8', '#4ade80', '#f87171', '#a78bfa', '#9ca3af'],
  },
  CLARO: {
    texto: '#374151',
    rejilla: '#e5e7eb',
    facturado: '#0369a1',
    recaudado: '#15803d',
    serie: ['#ca8a04', '#0369a1', '#15803d', '#b91c1c', '#7c3aed', '#6b7280'],
  },
};

/** Máximo de colegios en la dona; el resto se agrupa en "Otros". */
const COLEGIOS_EN_DONA = 5;
const EVENTOS_AGENDA = 6;

/** Inicio: resumen del mes, lo que requiere atención, agenda y gráficas con los datos de todos los módulos. */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgApexchartsModule, RouterLink, CurrencyPipe],
  templateUrl: './dashboard-page.html',
})
export default class DashboardPage {
  private readonly repositorio = inject(TableroRepositorio);
  private readonly cambios = inject(CambiosDatos);
  private readonly temaApp = inject(TemaApp);

  protected readonly modoLocal = esFuenteLocal(this.repositorio);
  protected readonly tablero = signal<Tablero>(TABLERO_VACIO);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly mesesGrafico = signal<6 | 12>(6);

  protected readonly nivel = nivel;
  protected readonly iconosAgenda = ICONOS_AGENDA;
  protected readonly diasAgenda = DIAS_AGENDA;
  protected readonly nombrePeriodo = nombrePeriodo;
  protected readonly fechaCorta = fechaCorta;

  private readonly ahora = new Date();
  protected readonly saludo = `${this.ahora.getHours() < 12 ? 'Buenos días' : this.ahora.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${inject(AuthService).sesion()?.nombre.split(' ')[0] ?? ''}`;
  protected readonly fechaHoy = this.ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  protected readonly accesos = [
    { texto: 'Registrar pago', icono: 'fa-solid fa-receipt', ruta: '/finanzas/recibos', principal: true },
    { texto: 'Nueva factura', icono: 'fa-solid fa-file-invoice-dollar', ruta: '/finanzas/facturas', principal: false },
    { texto: 'Nuevo estudiante', icono: 'fa-solid fa-user-graduate', ruta: '/personas/estudiantes', principal: false },
    { texto: 'Nueva cotización', icono: 'fa-solid fa-file-lines', ruta: '/finanzas/cotizaciones', principal: false },
  ];

  // Indicadores
  protected readonly porcentajeRecaudo = computed(() => {
    const { recaudado, esperado } = this.tablero().recaudo;
    return esperado ? Math.min(100, Math.round((recaudado / esperado) * 100)) : null;
  });
  protected readonly variacionRecaudo = computed(() => {
    const { recaudado, anterior } = this.tablero().recaudo;
    return anterior ? Math.round(((recaudado - anterior) / anterior) * 100) : null;
  });
  protected readonly criticos = computed(() => this.tablero().pendientes.filter((p) => p.nivel === 'CRITICA').length);
  protected readonly agenda = computed(() => this.tablero().agenda.slice(0, EVENTOS_AGENDA));
  protected readonly rutasConVehiculo = computed(() => this.tablero().ocupacionRutas.filter((r) => r.capacidad));
  protected readonly rutasSinVehiculo = computed(() => this.tablero().ocupacionRutas.filter((r) => !r.capacidad));

  // Gráficas
  protected readonly graficoRecaudo = computed(() => {
    const historico = this.tablero().historico.slice(-this.mesesGrafico());
    const COLORES = COLORES_TEMA[this.temaApp.tema()];
    return {
      series: [
        { name: 'Facturado', data: historico.map((m) => m.facturado) },
        { name: 'Recaudado', data: historico.map((m) => m.recaudado) },
      ] as ApexAxisChartSeries,
      chart: { type: 'bar', height: 320, toolbar: { show: false }, background: 'transparent', foreColor: COLORES.texto, fontFamily: 'inherit' } as ApexChart,
      plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } } as ApexPlotOptions,
      dataLabels: { enabled: false } as ApexDataLabels,
      stroke: { show: true, width: 2, colors: ['transparent'] } as ApexStroke,
      xaxis: { categories: historico.map((m) => nombrePeriodo(m.periodo)), axisBorder: { show: false }, axisTicks: { show: false } } as ApexXAxis,
      yaxis: { labels: { formatter: (v: number) => pesosCortos.format(v) } } as ApexYAxis,
      grid: { borderColor: COLORES.rejilla, strokeDashArray: 4 } as ApexGrid,
      legend: { position: 'top', horizontalAlign: 'right' } as ApexLegend,
      tooltip: { theme: this.temaApp.tema() === 'CLARO' ? 'light' : 'dark', y: { formatter: (v: number) => pesos.format(v) } } as ApexTooltip,
      colors: [COLORES.facturado, COLORES.recaudado],
    };
  });

  protected readonly graficoColegios = computed(() => {
    const lista = this.tablero().estudiantesPorColegio;
    const COLORES = COLORES_TEMA[this.temaApp.tema()];
    const principales = lista.slice(0, COLEGIOS_EN_DONA);
    const otros = lista.slice(COLEGIOS_EN_DONA).reduce((s, c) => s + c.cantidad, 0);
    const datos = otros ? [...principales, { colegio: 'Otros', cantidad: otros }] : principales;
    return {
      series: datos.map((c) => c.cantidad) as ApexNonAxisChartSeries,
      labels: datos.map((c) => c.colegio),
      chart: { type: 'donut', height: 300, background: 'transparent', foreColor: COLORES.texto, fontFamily: 'inherit' } as ApexChart,
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: { show: true, total: { show: true, label: 'Estudiantes', color: COLORES.texto } },
          },
        },
      } as ApexPlotOptions,
      dataLabels: { enabled: false } as ApexDataLabels,
      stroke: { width: 0 } as ApexStroke,
      legend: { position: 'bottom', labels: { colors: COLORES.texto } } as ApexLegend,
      tooltip: { theme: 'dark' } as ApexTooltip,
      colors: COLORES.serie,
    };
  });

  constructor() {
    // Carga al entrar y se actualiza cuando se guarda o elimina algo en cualquier módulo.
    effect(() => {
      this.cambios.version();
      untracked(() => void this.cargar());
    });
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.tablero.set(await firstValueFrom(this.repositorio.obtener()));
      this.error.set(null);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected faltan(fecha: string): string {
    const dias = diasEntre(fechaIso(), fecha);
    return dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`;
  }

  protected dia(fecha: string): string {
    return String(Number(fecha.slice(8, 10)));
  }

  protected mes(fecha: string): string {
    return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
  }

  protected nombreMedio(id: MedioPago): string {
    return MEDIOS_PAGO.find((m) => m.id === id)?.nombre ?? id;
  }

  protected ocupacion(r: OcupacionRuta): number {
    return r.capacidad ? Math.round((r.estudiantes / r.capacidad) * 100) : 0;
  }
}
