import { PanelFiltros } from 'src/app/shared/panel-filtros/panel-filtros';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AcudientesRepositorio } from 'src/app/personas/acudientes/acudientes-repositorio';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { descargarCsv } from 'src/app/shared/exportar/csv';
import { fechaCorta, nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { emitirEnVivo } from 'src/app/shared/formularios/formularios';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { PaginacionLocal } from 'src/app/shared/paginacion/paginacion-local';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { reporteEnVivo } from '../estado-reporte';
import { CuotaPendiente, FiltrosPendientes } from '../reportes';
import { ReportesRepositorio } from '../reportes-repositorio';

const SITUACIONES: OpcionCatalogo[] = [
  { id: 'VENCIDAS', nombre: 'Vencidas (en mora)' },
  { id: 'POR_VENCER', nombre: 'Por vencer (mes en curso)' },
];

@Component({
  selector: 'app-reporte-pendientes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFiltros, ReactiveFormsModule, SelectorBusqueda, Paginacion, CurrencyPipe, RouterLink],
  templateUrl: './reporte-pendientes-page.html',
})
export default class ReportePendientesPage {
  private readonly reportes = inject(ReportesRepositorio);
  protected readonly situaciones = SITUACIONES;
  protected readonly nombrePeriodo = nombrePeriodo;
  protected readonly fechaCorta = fechaCorta;

  protected readonly acudientes = toSignal(inject(AcudientesRepositorio).opciones().pipe(catchError(() => of<OpcionCatalogo[]>([]))), {
    initialValue: [],
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    texto: '',
    acudienteId: '',
    situacion: '' as FiltrosPendientes['situacion'],
  });
  protected readonly filtros = signal<FiltrosPendientes>(this.form.getRawValue());
  protected readonly reporte = reporteEnVivo(this.filtros, (f) => this.reportes.pendientes(f), [] as CuotaPendiente[]);
  protected readonly paginacion = new PaginacionLocal(computed(() => this.reporte().datos));

  protected readonly resumen = computed(() => {
    const cuotas = this.reporte().datos;
    const vencidas = cuotas.filter((c) => c.diasMora > 0);
    const porVencer = cuotas.filter((c) => c.diasMora <= 0);
    return {
      total: cuotas.reduce((s, c) => s + c.valor, 0),
      vencidas: vencidas.length,
      valorVencidas: vencidas.reduce((s, c) => s + c.valor, 0),
      porVencer: porVencer.length,
      valorPorVencer: porVencer.reduce((s, c) => s + c.valor, 0),
    };
  });

  constructor() {
    emitirEnVivo(this.form, { emit: (f: FiltrosPendientes) => this.filtros.set(f) });
    // Página 1 al cambiar los filtros (no en la recarga automática, que conserva la página).
    effect(() => {
      this.filtros();
      untracked(() => this.paginacion.reiniciar());
    });
  }

  protected textoDias(c: CuotaPendiente): string {
    if (c.diasMora > 0) return `${c.diasMora} día(s) de mora`;
    if (c.diasMora === 0) return 'Vence hoy';
    return `Vence en ${-c.diasMora} día(s)`;
  }

  protected reintentar(): void {
    this.filtros.set({ ...this.filtros() });
  }

  protected exportar(): void {
    descargarCsv(
      'facturas-pendientes',
      ['Factura', 'Acudiente', 'Estudiante', 'Mes', 'Fecha límite', 'Días de mora', 'Valor'],
      this.reporte().datos.map((c) => [
        c.numeroFactura,
        c.nombreAcudiente,
        c.nombreEstudiante,
        c.periodo,
        c.fechaLimite,
        Math.max(0, c.diasMora),
        c.valor,
      ]),
    );
  }
}
