import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import {
  ESTADOS_PAGO,
  FUNCIONES_PLAN,
  MESES_PAGADOS_POR_ANIO,
  MESES_PRUEBA,
  ORDEN_PLAN,
  PLANES,
  PagoSuscripcion,
  PeriodoPago,
  Plan,
  Suscripcion,
  leerRetornoPago,
  nombrePlan,
} from './suscripcion';
import { SuscripcionRepositorio } from './suscripcion-repositorio';
import { TarjetaPlan } from './tarjeta-plan/tarjeta-plan';

/** Fila de la tabla comparativa: `true`/`false` o un texto por plan. */
interface FilaComparativa {
  nombre: string;
  valores: (boolean | string)[];
}

const INTENTOS_CONFIRMACION = 12;
const ESPERA_CONFIRMACION_MS = 5000;

/**
 * Sistema › Planes y membresías: el plan de la empresa (prueba, días restantes, uso frente a los límites), los
 * cuatro planes con precio mensual/anual, la comparativa, el pago con Wompi Web Checkout y el historial.
 * Al volver de Wompi (`?pago=<referencia>&id=<transacción>`) pide al servidor que confirme la transacción con
 * Wompi y espera la confirmación (el navegador nunca activa el plan).
 */
@Component({
  selector: 'app-membresias-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, Modal, RouterLink, TarjetaPlan],
  templateUrl: './membresias-page.html',
})
export default class MembresiasPage {
  private readonly repositorio = inject(SuscripcionRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly modoLocal = esFuenteLocal(this.repositorio);
  protected readonly mesesPrueba = MESES_PRUEBA;
  protected readonly mesesGratisAnual = 12 - MESES_PAGADOS_POR_ANIO;
  protected readonly estadosPago = ESTADOS_PAGO;
  protected readonly nombrePlan = nombrePlan;

  protected readonly planes = signal<Plan[]>(PLANES);
  protected readonly suscripcion = signal<Suscripcion | null>(null);
  protected readonly pagos = signal<PagoSuscripcion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly periodo = signal<PeriodoPago>('MENSUAL');

  /** Plan elegido para pagar (modal de confirmación). */
  protected readonly elegido = signal<Plan | null>(null);
  protected readonly modalPago = signal(false);
  protected readonly redirigiendo = signal(false);
  /** Resultado al volver de Wompi. */
  protected readonly confirmacion = signal<{ estado: 'VERIFICANDO' | PagoSuscripcion['estado']; pago: PagoSuscripcion | null } | null>(null);

  /** Wompi configurado en el servidor; si no, el plan se solicita por Soporte y lo activa la plataforma. */
  protected readonly pagoEnLinea = computed(() => this.suscripcion()?.pagosEnLinea ?? false);
  protected readonly enPrueba = computed(() => this.suscripcion()?.estado === 'PRUEBA');
  protected readonly progresoPrueba = computed(() => {
    const dias = this.suscripcion()?.diasRestantes ?? 0;
    return Math.min(100, Math.max(0, Math.round(((MESES_PRUEBA * 30 - dias) / (MESES_PRUEBA * 30)) * 100)));
  });
  protected readonly usoVehiculos = computed(() => this.uso('vehiculos'));
  protected readonly usoEstudiantes = computed(() => this.uso('estudiantes'));

  protected readonly comparativa = computed<FilaComparativa[]>(() => {
    const p = this.planes();
    const limite = (n: number | null) => (n === null ? 'Sin límite' : String(n));
    const tiene = (f: string) => p.map((x) => x.funciones.includes(f));
    return [
      { nombre: 'Vehículos activos', valores: p.map((x) => limite(x.limites.vehiculos)) },
      { nombre: 'Estudiantes activos', valores: p.map((x) => limite(x.limites.estudiantes)) },
      { nombre: 'Ruta del día y asistencia', valores: p.map(() => true) },
      { nombre: 'Facturación, recibos y portal del acudiente', valores: p.map(() => true) },
      { nombre: 'Recordatorios automáticos de cobro', valores: tiene(FUNCIONES_PLAN.RECORDATORIOS) },
      { nombre: 'Reportes y exportación a CSV', valores: tiene(FUNCIONES_PLAN.RECORDATORIOS) },
      { nombre: 'GPS en vivo y mapa para acudientes', valores: tiene(FUNCIONES_PLAN.GPS_EN_VIVO) },
      { nombre: 'Soporte prioritario', valores: tiene(FUNCIONES_PLAN.SOPORTE_PRIORITARIO) },
      { nombre: 'Capacitación y acompañamiento', valores: tiene(FUNCIONES_PLAN.ACOMPANAMIENTO) },
    ];
  });

  constructor() {
    void this.cargar();
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((q) => {
        const retorno = leerRetornoPago(q.get('pago'), q.get('id'));
        if (retorno) void this.confirmar(retorno.referencia, retorno.idTransaccion);
      });
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [planes, suscripcion, pagos] = await Promise.all([
        firstValueFrom(this.repositorio.planes()),
        firstValueFrom(this.repositorio.actual()),
        firstValueFrom(this.repositorio.pagos()),
      ]);
      this.planes.set(planes);
      this.suscripcion.set(suscripcion);
      this.pagos.set(pagos);
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected precio(p: Plan): number {
    return this.periodo() === 'ANUAL' ? p.precioAnual : p.precioMensual;
  }

  protected esActual(p: Plan): boolean {
    return this.suscripcion()?.plan === p.id;
  }

  /** Texto del botón de cada plan. */
  protected accion(p: Plan): string {
    const s = this.suscripcion();
    if (p.precioMensual === 0) return s?.plan === 'GRATIS' ? 'Tu plan actual' : 'Incluido al terminar';
    if (!s) return `Elegir ${p.nombre}`;
    if (s.plan === p.id) return s.estado === 'PRUEBA' ? `Quedarme con ${p.nombre}` : 'Renovar';
    return ORDEN_PLAN[p.id] > ORDEN_PLAN[s.plan] ? `Mejorar a ${p.nombre}` : `Cambiar a ${p.nombre}`;
  }

  protected elegir(p: Plan): void {
    if (p.precioMensual === 0) return;
    this.elegido.set(p);
    this.modalPago.set(true);
  }

  /** Abre el Web Checkout de Wompi con la firma que calcula el servidor. */
  protected async pagar(): Promise<void> {
    const p = this.elegido();
    if (!p) return;
    this.redirigiendo.set(true);
    try {
      const checkout = await firstValueFrom(this.repositorio.iniciarPago(p.id, this.periodo()));
      window.location.assign(checkout.url);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
      this.redirigiendo.set(false);
    }
  }

  /** Sin pago en línea: el plan se pide en Soporte (la plataforma lo activa en Empresas › Plan). */
  protected solicitarPorSoporte(): void {
    this.modalPago.set(false);
    void this.router.navigate(['/sistema/soporte']);
  }

  /** Al volver de Wompi: confirma con el servidor y espera la confirmación (evento) si aún está pendiente. */
  private async confirmar(referencia: string, idTransaccion: string): Promise<void> {
    this.confirmacion.set({ estado: 'VERIFICANDO', pago: null });
    let cancelado = false;
    this.destroyRef.onDestroy(() => (cancelado = true));
    for (let intento = 0; intento < INTENTOS_CONFIRMACION && !cancelado; intento++) {
      try {
        const pago = await firstValueFrom(this.repositorio.verificarPago(referencia, idTransaccion));
        if (pago.estado !== 'PENDIENTE' || intento === INTENTOS_CONFIRMACION - 1) {
          this.confirmacion.set({ estado: pago.estado, pago });
          if (pago.estado === 'APROBADO') {
            this.avisos.exito(`¡Pago aprobado! Tu plan ${nombrePlan(pago.plan)} está activo.`);
          }
          await this.cargar();
          break;
        }
      } catch (e) {
        this.confirmacion.set(null);
        this.avisos.error(mensajeDeError(e));
        break;
      }
      await new Promise((r) => setTimeout(r, ESPERA_CONFIRMACION_MS));
    }
    void this.router.navigate([], { queryParams: { pago: null, id: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private uso(tipo: 'vehiculos' | 'estudiantes'): { usados: number; limite: number | null; porcentaje: number; clase: string } {
    const s = this.suscripcion();
    const usados = s?.uso[tipo] ?? 0;
    const limite = s?.limites[tipo] ?? null;
    const porcentaje = limite ? Math.min(100, Math.round((usados / limite) * 100)) : 0;
    return { usados, limite, porcentaje, clase: porcentaje >= 100 ? 'progress-error' : porcentaje >= 80 ? 'progress-warning' : 'progress-success' };
  }
}
