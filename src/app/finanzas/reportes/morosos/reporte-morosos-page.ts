import { PanelFiltros } from 'src/app/shared/panel-filtros/panel-filtros';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { descargarCsv } from 'src/app/shared/exportar/csv';
import { nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { emitirEnVivo } from 'src/app/shared/formularios/formularios';
import { Paginacion } from 'src/app/shared/paginacion/paginacion';
import { PaginacionLocal } from 'src/app/shared/paginacion/paginacion-local';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { reporteEnVivo } from '../estado-reporte';
import { FiltrosMorosos, Moroso, RANGOS_MORA } from '../reportes';
import { ReportesRepositorio } from '../reportes-repositorio';

const formatoPesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

@Component({
  selector: 'app-reporte-morosos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelFiltros, ReactiveFormsModule, SelectorBusqueda, Paginacion, CurrencyPipe],
  templateUrl: './reporte-morosos-page.html',
})
export default class ReporteMorososPage {
  private readonly reportes = inject(ReportesRepositorio);
  protected readonly rangos = RANGOS_MORA;
  protected readonly nombrePeriodo = nombrePeriodo;

  protected readonly form = inject(NonNullableFormBuilder).group({ texto: '', diasMinimos: '0' });
  protected readonly filtros = signal<FiltrosMorosos>({ texto: '', diasMinimos: 0 });
  protected readonly reporte = reporteEnVivo(this.filtros, (f) => this.reportes.morosos(f), [] as Moroso[]);
  protected readonly paginacion = new PaginacionLocal(computed(() => this.reporte().datos));

  protected readonly resumen = computed(() => {
    const morosos = this.reporte().datos;
    return {
      cantidad: morosos.length,
      adeudado: morosos.reduce((s, m) => s + m.valorAdeudado, 0),
      cuotas: morosos.reduce((s, m) => s + m.cuotas, 0),
      masDe90: morosos.filter((m) => m.diasMoraMaxima > 90).length,
    };
  });

  constructor() {
    emitirEnVivo(this.form, {
      emit: (v: { texto: string; diasMinimos: string }) => this.filtros.set({ texto: v.texto, diasMinimos: Number(v.diasMinimos) || 0 }),
    });
    // Página 1 al cambiar los filtros (no en la recarga automática, que conserva la página).
    effect(() => {
      this.filtros();
      untracked(() => this.paginacion.reiniciar());
    });
  }

  protected mensaje(m: Moroso): string {
    const meses = m.periodos.map((p) => nombrePeriodo(p, true)).join(', ');
    return (
      `Hola ${m.nombreAcudiente}, te recordamos que el servicio de transporte escolar de ${m.estudiantes.join(' y ')} ` +
      `tiene ${m.cuotas} mensualidad(es) pendiente(s) (${meses}) por un total de ${formatoPesos.format(m.valorAdeudado)}. ` +
      `Si ya realizaste el pago, por favor envíanos el comprobante. ¡Gracias!`
    );
  }

  /** Enlace a WhatsApp (se asume indicativo de Colombia si el número tiene 10 dígitos). */
  protected enlaceWhatsapp(m: Moroso): string | null {
    const digitos = m.telefono.replace(/\D/g, '');
    if (!digitos) return null;
    const numero = digitos.length === 10 ? `57${digitos}` : digitos;
    return `https://wa.me/${numero}?text=${encodeURIComponent(this.mensaje(m))}`;
  }

  protected enlaceCorreo(m: Moroso): string | null {
    if (!m.correo) return null;
    const asunto = encodeURIComponent('Recordatorio de pago · Transporte escolar');
    return `mailto:${m.correo}?subject=${asunto}&body=${encodeURIComponent(this.mensaje(m))}`;
  }

  protected reintentar(): void {
    this.filtros.set({ ...this.filtros() });
  }

  protected exportar(): void {
    descargarCsv(
      'morosos',
      ['Acudiente', 'Teléfono', 'Correo', 'Estudiantes', 'Facturas', 'Cuotas vencidas', 'Meses', 'Mora máxima (días)', 'Valor adeudado'],
      this.reporte().datos.map((m) => [
        m.nombreAcudiente,
        m.telefono,
        m.correo,
        m.estudiantes.join(', '),
        m.facturas.join(', '),
        m.cuotas,
        m.periodos.join(', '),
        m.diasMoraMaxima,
        m.valorAdeudado,
      ]),
    );
  }
}
