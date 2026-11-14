import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { esFuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { ValidacionCodigo, textoDescuento } from 'src/app/plataforma/codigos-promocionales/codigo-promocional';
import { PlanEmpresa } from 'src/app/core/plan-empresa';
import { DialogoConfirmacion } from 'src/app/shared/dialogo-confirmacion/dialogo-confirmacion';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import {
  DIAS_PRUEBA_POR_DEFECTO,
  ESTADOS_PAGO,
  FUNCIONES_PLAN,
  FuncionPlan,
  MESES_PAGADOS_POR_ANIO,
  NOMBRES_FUNCION,
  ORDEN_PLAN,
  PLANES,
  PagoSuscripcion,
  PeriodoPago,
  Plan,
  Suscripcion,
  excedentes,
  leerRetornoPago,
  nombrePlan,
  planDesdeConFuncion,
  puedeIniciarPrueba,
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
  imports: [CurrencyPipe, DatePipe, DialogoConfirmacion, Modal, RouterLink, TarjetaPlan],
  templateUrl: './membresias-page.html',
})
export default class MembresiasPage {
  private readonly repositorio = inject(SuscripcionRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly planEmpresa = inject(PlanEmpresa);

  protected readonly modoLocal = esFuenteLocal(this.repositorio);
  /** Días de prueba que recibe hoy una empresa nueva (los fija la plataforma). */
  protected readonly diasPrueba = signal(DIAS_PRUEBA_POR_DEFECTO);
  /** Llegó desde una pantalla que su plan no incluye (`?funcion=`). */
  protected readonly funcionBloqueada = signal<{ nombre: string; plan: string } | null>(null);
  // "Seguir en Gratis" cuando venció la prueba o el plan.
  protected readonly confirmarGratis = signal(false);
  protected readonly pasandoAGratis = signal(false);
  protected readonly pendienteDecision = computed(() => this.suscripcion()?.pendienteDecision ?? false);
  protected readonly mensajeGratis = computed(() => {
    const s = this.suscripcion();
    if (!s) return '';
    const sobra = excedentes(s, PLANES[0]);
    const partes = [
      sobra.vehiculos ? `${sobra.vehiculos} vehículo(s)` : '',
      sobra.estudiantes ? `${sobra.estudiantes} estudiante(s)` : '',
    ].filter(Boolean);
    return partes.length
      ? `El plan Gratis permite ${PLANES[0].limites.vehiculos} vehículo y ${PLANES[0].limites.estudiantes} estudiantes activos: se inactivarán ${partes.join(' y ')} (se conservan primero los que están en rutas). Tus datos no se borran; para activar otro, inactiva primero uno activo o mejora tu plan.`
      : 'Seguirás en el plan Gratis con todos tus datos. Puedes mejorar tu plan cuando quieras.';
  });
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
  // Código promocional (solo descuenta el primer mes que se factura).
  protected readonly codigoTexto = signal('');
  protected readonly codigoAplicado = signal<ValidacionCodigo | null>(null);
  protected readonly errorCodigo = signal<string | null>(null);
  protected readonly aplicandoCodigo = signal(false);
  protected readonly textoDescuento = textoDescuento;
  /** Total del modal: con el código aplicado, el que calculó el servidor. */
  protected readonly totalAPagar = computed(() => {
    const p = this.elegido();
    return this.codigoAplicado()?.total ?? (p ? this.precio(p) : 0);
  });
  /** El código cubre todo el primer pago: el plan se activa sin pasar por Wompi. */
  protected readonly sinCobro = computed(() => this.codigoAplicado()?.total === 0);

  /** Resultado al volver de Wompi. */
  protected readonly confirmacion = signal<{ estado: 'VERIFICANDO' | PagoSuscripcion['estado']; pago: PagoSuscripcion | null } | null>(null);

  /** Wompi configurado en el servidor; si no, el plan se solicita por Soporte y lo activa la plataforma. */
  protected readonly pagoEnLinea = computed(() => this.suscripcion()?.pagosEnLinea ?? false);
  protected readonly enPrueba = computed(() => this.suscripcion()?.estado === 'PRUEBA');
  /** Se registró en Gratis y nunca usó la prueba. */
  protected readonly puedeProbar = computed(() => puedeIniciarPrueba(this.suscripcion()));
  protected readonly iniciandoPrueba = signal(false);
  protected readonly progresoPrueba = computed(() => {
    const s = this.suscripcion();
    const dias = s?.diasRestantes ?? 0;
    const total = s?.diasPrueba || this.diasPrueba();
    return Math.min(100, Math.max(0, Math.round(((total - dias) / total) * 100)));
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
      { nombre: 'Reportes y exportación a CSV', valores: tiene(FUNCIONES_PLAN.REPORTES) },
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
        const funcion = q.get('funcion') as FuncionPlan | null;
        this.funcionBloqueada.set(
          funcion && funcion in NOMBRES_FUNCION ? { nombre: NOMBRES_FUNCION[funcion], plan: planDesdeConFuncion(funcion).nombre } : null,
        );
        // Desde la pasarela al iniciar sesión (`?plan=&periodo=`): abre el pago de ese plan.
        const plan = q.get('plan');
        if (plan) {
          if (q.get('periodo') === 'ANUAL' || q.get('periodo') === 'MENSUAL') this.periodo.set(q.get('periodo') as PeriodoPago);
          void this.abrirPlanAlCargar(plan);
        }
      });
    this.repositorio
      .condiciones()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (c) => this.diasPrueba.set(c.diasPrueba), error: () => undefined });
  }

  private carga: Promise<void> | null = null;

  private async abrirPlanAlCargar(id: string): Promise<void> {
    await this.carga;
    const p = this.planes().find((x) => x.id === id);
    if (p && p.precioMensual > 0) this.elegir(p);
    void this.router.navigate([], { queryParams: { plan: null, periodo: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** No quiere pagar: sigue en Gratis (el servidor inactiva lo que sobre). */
  protected async seguirEnGratis(): Promise<void> {
    this.pasandoAGratis.set(true);
    try {
      const d = await this.planEmpresa.continuarGratis();
      this.confirmarGratis.set(false);
      const total = d.inactivados.vehiculos.length + d.inactivados.estudiantes;
      this.avisos.exito(
        total
          ? `Sigues en el plan Gratis. Se inactivaron ${d.inactivados.vehiculos.length} vehículo(s) y ${d.inactivados.estudiantes} estudiante(s) que superaban el límite.`
          : 'Sigues en el plan Gratis con todos tus datos.',
      );
      await this.cargar();
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.pasandoAGratis.set(false);
    }
  }

  /** Inicia la prueba del plan Profesional (una sola vez). */
  protected async probarProfesional(): Promise<void> {
    this.iniciandoPrueba.set(true);
    try {
      const s = await this.planEmpresa.iniciarPrueba();
      this.suscripcion.set(s);
      this.avisos.exito(`Tu prueba del plan ${s.nombrePlan} empezó: tienes ${s.diasRestantes ?? this.diasPrueba()} días con todas sus funciones.`);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.iniciandoPrueba.set(false);
    }
  }

  protected cargar(): Promise<void> {
    this.carga = this.cargarDatos();
    return this.carga;
  }

  private async cargarDatos(): Promise<void> {
    this.cargando.set(true);
    try {
      const [planes, suscripcion, pagos] = await Promise.all([
        firstValueFrom(this.repositorio.planes()),
        firstValueFrom(this.repositorio.actual()),
        firstValueFrom(this.repositorio.pagos()),
      ]);
      this.planes.set(planes);
      this.suscripcion.set(suscripcion);
      this.planEmpresa.establecer(suscripcion);
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
    if (p.precioMensual === 0) return s?.pendienteDecision ? 'Seguir en Gratis' : s?.plan === 'GRATIS' ? 'Tu plan actual' : 'Incluido al terminar';
    if (!s) return `Elegir ${p.nombre}`;
    if (s.plan === p.id) return s.estado === 'PRUEBA' ? `Quedarme con ${p.nombre}` : 'Renovar';
    return ORDEN_PLAN[p.id] > ORDEN_PLAN[s.plan] ? `Mejorar a ${p.nombre}` : `Cambiar a ${p.nombre}`;
  }

  protected elegir(p: Plan): void {
    if (p.precioMensual === 0) {
      if (this.pendienteDecision()) this.confirmarGratis.set(true);
      return;
    }
    this.elegido.set(p);
    this.quitarCodigo();
    this.modalPago.set(true);
  }

  /** Cambiar el periodo con un código aplicado lo vuelve a validar (puede ser solo mensual o solo anual). */
  protected cambiarPeriodo(periodo: PeriodoPago): void {
    this.periodo.set(periodo);
    if (this.codigoAplicado()) void this.aplicarCodigo();
  }

  protected escribirCodigo(evento: Event): void {
    this.codigoTexto.set((evento.target as HTMLInputElement).value.toUpperCase());
    this.errorCodigo.set(null);
  }

  protected async aplicarCodigo(): Promise<void> {
    const p = this.elegido();
    const codigo = this.codigoTexto().trim();
    if (!p || !codigo || this.aplicandoCodigo()) return;
    this.aplicandoCodigo.set(true);
    try {
      this.codigoAplicado.set(await firstValueFrom(this.repositorio.validarCodigo(codigo, p.id, this.periodo())));
      this.errorCodigo.set(null);
    } catch (e) {
      this.codigoAplicado.set(null);
      this.errorCodigo.set(mensajeDeError(e));
    } finally {
      this.aplicandoCodigo.set(false);
    }
  }

  protected quitarCodigo(): void {
    this.codigoAplicado.set(null);
    this.codigoTexto.set('');
    this.errorCodigo.set(null);
  }

  /** Abre el Web Checkout de Wompi con la firma que calcula el servidor. */
  protected async pagar(): Promise<void> {
    const p = this.elegido();
    if (!p) return;
    this.redirigiendo.set(true);
    try {
      const checkout = await firstValueFrom(this.repositorio.iniciarPago(p.id, this.periodo(), this.codigoAplicado()?.codigo ?? ''));
      if (!checkout.url) {
        // El código cubrió todo el primer pago: el servidor ya activó el plan.
        this.avisos.exito(`¡Listo! Tu plan ${p.nombre} está activo.`);
        this.modalPago.set(false);
        this.redirigiendo.set(false);
        await this.cargar();
        return;
      }
      window.location.assign(checkout.url);
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
      this.redirigiendo.set(false);
    }
  }

  /** Sin pago en línea: el plan se pide en Soporte (la plataforma lo activa en Empresas › Plan). */
  protected solicitarPorSoporte(): void {
    const p = this.elegido();
    this.modalPago.set(false);
    if (!p) return;
    const periodo = this.periodo() === 'ANUAL' ? 'anual' : 'mensual';
    const c = this.codigoAplicado();
    const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`;
    const descripcion = [
      `Quiero activar el plan ${p.nombre} con pago ${periodo}.`,
      c ? `Código promocional: ${c.codigo} (descuento de ${pesos(c.descuento)} en el primer mes; total ${pesos(c.total)}).` : '',
      'Por favor envíenme los datos para el pago.',
    ]
      .filter(Boolean)
      .join(' ');
    // Precarga la solicitud de soporte; la plataforma activa el plan (y aplica el código) en Empresas › Plan.
    void this.router.navigate(['/sistema/soporte'], {
      queryParams: { tipo: 'CONSULTA', modulo: 'Sistema › Planes y Membresías', asunto: `Quiero el plan ${p.nombre} (${periodo})`, descripcion },
    });
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
