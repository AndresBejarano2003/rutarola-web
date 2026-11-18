import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CambiosDatos } from 'src/app/shared/crud/cambios-datos';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { recargaAutomatica } from 'src/app/shared/crud/recarga-automatica';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import {
  AusenciaCronograma,
  Cronograma,
  DetalleDiaCronograma,
  DiaCronograma,
  ESTADOS_TRAYECTO,
  RutaCronograma,
  ICONOS_EVENTO,
  VistaCronograma,
  moverVista,
  nivelDelDia,
  rangoVista,
  semanasDelMes,
} from './cronograma';
import { CronogramaRepositorio } from './cronograma-repositorio';
import { DetalleRutaDia } from './detalle-ruta-dia/detalle-ruta-dia';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const VISTAS: { id: VistaCronograma; nombre: string }[] = [
  { id: 'SEMANA', nombre: 'Semana' },
  { id: 'MES', nombre: 'Mes' },
  { id: 'ANIO', nombre: 'Año' },
];

/** Clases del punto/borde según el nivel más alto de la agenda del día. */
const TONO_NIVEL: Record<string, string> = {
  CRITICA: 'bg-error',
  ADVERTENCIA: 'bg-warning',
  INFORMATIVA: 'bg-info',
  EXITO: 'bg-success',
};

/**
 * Operación › Cronograma (planes con CRONOGRAMA, desde Profesional): la programación por semana, mes o año. Cada día
 * muestra las rutas programadas, los recorridos realizados, los avisos de ausencia de los acudientes y la agenda
 * (vencimientos de documentos y licencias, fechas límite de pago, fin de contratos y asignaciones). Al elegir un día se
 * ve el detalle: cada ruta con su recogida y entrega, quién no viaja y por qué. `?vista=&fecha=` en la URL.
 */
@Component({
  selector: 'app-cronograma-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, DetalleRutaDia],
  templateUrl: './cronograma-page.html',
})
export default class CronogramaPage {
  private readonly repositorio = inject(CronogramaRepositorio);
  private readonly router = inject(Router);
  private readonly cambios = inject(CambiosDatos);

  protected readonly vistas = VISTAS;
  protected readonly diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  protected readonly estadosTrayecto = ESTADOS_TRAYECTO;
  protected readonly iconosEvento = ICONOS_EVENTO;
  protected readonly tonoNivel = TONO_NIVEL;
  protected readonly nivelDelDia = nivelDelDia;
  protected readonly hoy = fechaIso();

  protected readonly vista = signal<VistaCronograma>('SEMANA');
  /** Día de referencia de la vista y día cuyo detalle se muestra. */
  protected readonly fecha = signal(this.hoy);
  protected readonly cronograma = signal<Cronograma | null>(null);
  protected readonly detalle = signal<DetalleDiaCronograma | null>(null);
  protected readonly cargando = signal(true);
  protected readonly cargandoDia = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Ruta elegida en el detalle del día (abre su modal). */
  protected readonly rutaElegida = signal<RutaCronograma | null>(null);
  protected readonly rutaAbierta = signal(false);

  protected abrirRuta(r: RutaCronograma): void {
    this.rutaElegida.set(r);
    this.rutaAbierta.set(true);
  }

  protected readonly rango = computed(() => rangoVista(this.vista(), this.fecha()));
  protected readonly titulo = computed(() => {
    const { desde, hasta } = this.rango();
    const mes = (f: string) => MESES[+f.slice(5, 7) - 1];
    if (this.vista() === 'ANIO') return desde.slice(0, 4);
    if (this.vista() === 'MES') return `${mes(desde)} de ${desde.slice(0, 4)}`;
    const d = (f: string) => `${+f.slice(8, 10)} ${mes(f).slice(0, 3)}`;
    return `${d(desde)} – ${d(hasta)} ${hasta.slice(0, 4)}`;
  });

  private readonly porFecha = computed(() => new Map((this.cronograma()?.dias ?? []).map((d) => [d.fecha, d])));
  protected readonly semana = computed(() => (this.vista() === 'SEMANA' ? (this.cronograma()?.dias ?? []) : []));
  protected readonly mes = computed(() => (this.vista() === 'MES' ? semanasDelMes(this.rango().desde) : []));
  protected readonly anio = computed(() => {
    if (this.vista() !== 'ANIO') return [];
    const y = this.rango().desde.slice(0, 4);
    return MESES.map((nombre, i) => ({ nombre, inicio: `${y}-${String(i + 1).padStart(2, '0')}-01` })).map((m) => ({
      ...m,
      semanas: semanasDelMes(m.inicio),
      ausencias: (this.cronograma()?.dias ?? []).filter((d) => d.fecha.startsWith(m.inicio.slice(0, 7))).reduce((s, d) => s + d.ausencias, 0),
    }));
  });

  /** Totales de la vista. */
  protected readonly resumen = computed(() => {
    const dias = this.cronograma()?.dias ?? [];
    return {
      habiles: dias.filter((d) => d.habil).length,
      recorridos: dias.reduce((s, d) => s + d.finalizados, 0),
      ausencias: dias.reduce((s, d) => s + d.ausencias, 0),
      vencidos: dias.reduce((s, d) => s + d.eventos.filter((e) => e.nivel === 'CRITICA').length, 0),
      eventos: dias.reduce((s, d) => s + d.eventos.length, 0),
    };
  });

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const vista = q.get('vista');
    if (vista === 'MES' || vista === 'ANIO' || vista === 'SEMANA') this.vista.set(vista);
    const fecha = q.get('fecha');
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) this.fecha.set(fecha);

    effect(() => {
      const { desde, hasta } = this.rango();
      this.cambios.version();
      untracked(() => void this.cargar(desde, hasta));
    });
    effect(() => {
      const f = this.fecha();
      this.cambios.version();
      untracked(() => void this.cargarDia(f));
    });
    // Estados de los recorridos y avisos al día mientras la pantalla está visible.
    recargaAutomatica(
      () => {
        void this.cargar(this.rango().desde, this.rango().hasta, true);
        void this.cargarDia(this.fecha(), true);
      },
      () => !this.cargando() && !this.cargandoDia(),
    );
  }

  /** Qué avisó el acudiente, en palabras del aviso del portal. */
  protected textoAusencia(a: Pick<AusenciaCronograma, 'motivo' | 'trayecto'>): string {
    if (a.motivo === 'NO_ASISTE') return 'No asiste al colegio (no viaja en ningún trayecto)';
    if (a.trayecto === 'RECOGIDA') return 'Va al colegio por su cuenta (solo recogida)';
    if (a.trayecto === 'ENTREGA') return 'No viaja de regreso a casa (solo entrega)';
    return 'Va y vuelve por su cuenta (recogida y entrega)';
  }

  protected dia(fecha: string | null): DiaCronograma | undefined {
    return fecha ? this.porFecha().get(fecha) : undefined;
  }

  protected cambiarVista(v: VistaCronograma): void {
    this.vista.set(v);
    this.sincronizarUrl();
  }

  protected mover(paso: -1 | 1): void {
    this.fecha.set(moverVista(this.vista(), this.fecha(), paso));
    this.sincronizarUrl();
  }

  protected irAHoy(): void {
    this.fecha.set(this.hoy);
    this.sincronizarUrl();
  }

  protected elegir(fecha: string | null): void {
    if (!fecha) return;
    this.fecha.set(fecha);
    this.sincronizarUrl();
    document.getElementById('detalle-dia')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  /** En la vista de año, un mes abre su vista mensual. */
  protected abrirMes(inicio: string): void {
    this.fecha.set(inicio);
    this.cambiarVista('MES');
  }

  /** `silenciosa`: recarga automática, sin indicador y sin mostrar errores (se conserva lo que se ve). */
  protected async cargar(desde = this.rango().desde, hasta = this.rango().hasta, silenciosa = false): Promise<void> {
    if (!silenciosa) this.cargando.set(true);
    try {
      const datos = await firstValueFrom(this.repositorio.obtener(desde, hasta));
      // Si mientras tanto cambió la vista, se descarta la respuesta vieja.
      if (this.rango().desde === desde && this.rango().hasta === hasta) this.cronograma.set(datos);
      this.error.set(null);
    } catch (e) {
      if (!silenciosa) this.error.set(mensajeDeError(e));
    } finally {
      if (!silenciosa) this.cargando.set(false);
    }
  }

  private async cargarDia(fecha: string, silenciosa = false): Promise<void> {
    if (!silenciosa) this.cargandoDia.set(true);
    try {
      const detalle = await firstValueFrom(this.repositorio.dia(fecha));
      if (this.fecha() === fecha) this.detalle.set(detalle);
    } catch (e) {
      if (!silenciosa) this.error.set(mensajeDeError(e));
    } finally {
      if (!silenciosa) this.cargandoDia.set(false);
    }
  }

  private sincronizarUrl(): void {
    void this.router.navigate([], { queryParams: { vista: this.vista(), fecha: this.fecha() }, replaceUrl: true });
  }
}
