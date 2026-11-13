import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { PlanEmpresa } from 'src/app/core/plan-empresa';
import { mensajeDeError } from 'src/app/shared/crud/crud';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { PLANES, PeriodoPago, Plan, excedentes, nombrePlan } from '../suscripcion';

/** Rutas desde las que se paga o se pide ayuda: ahí no se muestra la pasarela encima. */
const RUTAS_LIBRES = ['/sistema/membership', '/sistema/soporte'];

/**
 * Pasarela al entrar cuando venció la prueba gratuita o el plan pagado (o la empresa se registró para pagar de una
 * vez): elige un plan (abre su pago en Planes y membresías) o sigue en el plan Gratis, que inactiva lo que supere sus
 * límites. No se puede cerrar sin decidir; no tapa Planes y membresías ni Soporte.
 */
@Component({
  selector: 'app-decision-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe],
  template: `
    @if (visible(); as s) {
      <div class="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-decision-plan">
        <div class="bg-base-200 border border-base-300 text-base-content w-full sm:max-w-3xl max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-t-box sm:rounded-box shadow-2xl">
          <header class="shrink-0 px-4 pt-5 pb-3 sm:px-6 border-b border-base-300">
            <h2 id="titulo-decision-plan" class="font-bold text-xl sm:text-2xl flex items-center gap-2">
              <i class="fa-solid fa-crown text-primary" aria-hidden="true"></i>
              @if (s.planVencido) {
                {{ s.planVencido === 'PROFESIONAL' && s.diasPrueba ? 'Tu prueba gratuita terminó' : 'Tu plan ' + nombrePlan(s.planVencido) + ' venció' }}
              } @else {
                Elige tu plan
              }
            </h2>
            <p class="text-sm text-base-content/70 mt-1">
              @if (s.planVencido) {
                @if (s.fechaVencimiento) { Venció el {{ s.fechaVencimiento | date: 'd MMM y' }}. }
                Paga un plan para seguir usando todo, o continúa con el plan Gratis.
              } @else {
                Elige el plan que quieres pagar, o empieza con el plan Gratis.
              }
            </p>
          </header>

          <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 flex flex-col gap-4">
            <div role="radiogroup" aria-label="Periodo de pago" class="join self-center">
              <button type="button" role="radio" class="btn btn-sm join-item" [attr.aria-checked]="periodo() === 'MENSUAL'"
                [class.bg-base-300]="periodo() !== 'MENSUAL'" [class.btn-secondary]="periodo() === 'MENSUAL'" (click)="periodo.set('MENSUAL')">Mensual</button>
              <button type="button" role="radio" class="btn btn-sm join-item" [attr.aria-checked]="periodo() === 'ANUAL'"
                [class.bg-base-300]="periodo() !== 'ANUAL'" [class.btn-secondary]="periodo() === 'ANUAL'" (click)="periodo.set('ANUAL')">Anual · 2 meses gratis</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              @for (p of planesPago; track p.id) {
                <button type="button" class="card bg-base-100 border text-left p-4 gap-1 hover:border-primary focus-visible:outline-2 cursor-pointer"
                  [class.border-primary]="p.destacado" [class.border-base-300]="!p.destacado" (click)="pagar(p)" [attr.aria-label]="'Pagar el plan ' + p.nombre">
                  <span class="flex items-center justify-between gap-2">
                    <span class="font-semibold">{{ p.nombre }}</span>
                    @if (p.destacado) { <span class="badge badge-sm badge-soft badge-warning">Recomendado</span> }
                  </span>
                  <span class="text-xl font-bold">
                    @if (p.precioDesde) { <span class="text-xs font-normal">desde </span> }
                    {{ (periodo() === 'ANUAL' ? p.precioAnual : p.precioMensual) | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
                    <span class="text-xs font-normal text-base-content/70">/{{ periodo() === 'ANUAL' ? 'año' : 'mes' }}</span>
                  </span>
                  <span class="text-xs text-base-content/70">{{ p.limites.vehiculos ?? 'Sin límite de' }} vehículos · {{ p.limites.estudiantes ?? 'sin límite de' }} estudiantes</span>
                  <span class="text-sm text-secondary mt-1">Pagar este plan <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
                </button>
              }
            </div>

            @if (confirmandoGratis()) {
              <div role="alert" class="alert alert-soft alert-warning text-sm items-start">
                <i class="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true"></i>
                <span>{{ mensajeGratis() }}</span>
              </div>
            }
          </div>

          <footer class="shrink-0 px-4 py-3 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-base-300 flex flex-wrap justify-end gap-2">
            @if (confirmandoGratis()) {
              <button type="button" class="btn bg-base-300 border-neutral hover:bg-neutral" (click)="confirmandoGratis.set(false)">Volver a los planes</button>
              <button type="button" class="btn btn-primary" [disabled]="procesando()" (click)="seguirEnGratis()">
                @if (procesando()) { <span class="loading loading-spinner loading-sm" aria-hidden="true"></span> }
                Sí, seguir en Gratis
              </button>
            } @else {
              <button type="button" class="btn bg-base-300 border-neutral hover:bg-neutral" (click)="confirmandoGratis.set(true)">No quiero pagar, seguir en Gratis</button>
            }
          </footer>
        </div>
      </div>
    }
  `,
})
export class DecisionPlan {
  private readonly plan = inject(PlanEmpresa);
  private readonly router = inject(Router);
  private readonly avisos = inject(NotificacionesService);

  protected readonly nombrePlan = nombrePlan;
  protected readonly planesPago = PLANES.filter((p) => p.precioMensual > 0);
  protected readonly periodo = signal<PeriodoPago>('MENSUAL');
  protected readonly confirmandoGratis = signal(false);
  protected readonly procesando = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly visible = computed(() => {
    const s = this.plan.suscripcion();
    const url = this.url();
    return s?.pendienteDecision && !RUTAS_LIBRES.some((r) => url.startsWith(r)) ? s : null;
  });

  protected readonly mensajeGratis = computed(() => {
    const s = this.plan.suscripcion();
    if (!s) return '';
    const gratis = PLANES[0];
    const sobra = excedentes(s, gratis);
    const partes = [sobra.vehiculos ? `${sobra.vehiculos} vehículo(s)` : '', sobra.estudiantes ? `${sobra.estudiantes} estudiante(s)` : ''].filter(Boolean);
    const base = `El plan Gratis permite ${gratis.limites.vehiculos} vehículo y ${gratis.limites.estudiantes} estudiantes activos, sin GPS en vivo, recordatorios ni reportes.`;
    return partes.length
      ? `${base} Se inactivarán ${partes.join(' y ')} (se conservan primero los que están en rutas). Tus datos no se borran: para activar otro, inactiva primero uno activo o mejora tu plan.`
      : `${base} Conservas todos tus datos.`;
  });

  constructor() {
    void this.plan.asegurar();
  }

  protected pagar(p: Plan): void {
    void this.router.navigate(['/sistema/membership'], { queryParams: { plan: p.id, periodo: this.periodo() } });
  }

  protected async seguirEnGratis(): Promise<void> {
    this.procesando.set(true);
    try {
      const d = await this.plan.continuarGratis();
      this.confirmandoGratis.set(false);
      const total = d.inactivados.vehiculos.length + d.inactivados.estudiantes;
      this.avisos.exito(
        total
          ? `Sigues en el plan Gratis. Se inactivaron ${d.inactivados.vehiculos.length} vehículo(s) y ${d.inactivados.estudiantes} estudiante(s) que superaban el límite.`
          : 'Sigues en el plan Gratis con todos tus datos.',
      );
    } catch (e) {
      this.avisos.error(mensajeDeError(e));
    } finally {
      this.procesando.set(false);
    }
  }
}
