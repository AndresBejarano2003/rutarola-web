import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlanEmpresa } from 'src/app/core/plan-empresa';
import { recordatorioGratis } from '../suscripcion';

const CLAVE_OCULTO = 'rutarola.aviso-plan.oculto';
/** Se avisa cuando a la prueba o al periodo pagado le quedan estos días o menos. */
export const DIAS_AVISO_PLAN = 15;
/** El recordatorio general del plan Gratis se puede ocultar por estos días; los demás avisos, hasta el día siguiente. */
export const DIAS_OCULTAR_RECORDATORIO_GRATIS = 7;

interface MensajePlan {
  /** Identifica el aviso: ocultar uno no oculta otro más urgente (p. ej. llegar al límite). */
  tipo: string;
  urgente: boolean;
  icono: string;
  texto: string;
}

/**
 * Aviso del plan en el shell del administrador: la prueba o el periodo pagado terminan pronto, o la empresa está en el
 * plan Gratis (recordatorio con sus límites y, si llegó o está cerca de uno, ese aviso primero). "Ocultar" guarda el
 * tipo de aviso en este navegador: el recordatorio general de Gratis por 7 días, los demás hasta el día siguiente.
 */
@Component({
  selector: 'app-aviso-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (mensaje(); as m) {
      <div role="status" class="alert alert-soft mb-4 flex-col sm:flex-row items-start sm:items-center" [class.alert-warning]="m.urgente" [class.alert-info]="!m.urgente">
        <i [class]="m.icono" aria-hidden="true"></i>
        <span class="grow text-sm">{{ m.texto }}</span>
        <div class="flex gap-2">
          <a routerLink="/sistema/membership" class="btn btn-sm btn-secondary">{{ m.tipo.startsWith('GRATIS') ? 'Mejorar mi plan' : 'Ver planes' }}</a>
          <button type="button" class="btn btn-sm btn-ghost" (click)="ocultar(m.tipo)" aria-label="Ocultar aviso"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
      </div>
    }
  `,
})
export class AvisoPlan {
  private readonly plan = inject(PlanEmpresa);
  private readonly suscripcion = this.plan.suscripcion;
  private readonly ocultos = signal(leerOcultos());

  protected readonly mensaje = computed<MensajePlan | null>(() => {
    const m = this.calcular();
    return m && !estaOculto(this.ocultos(), m.tipo) ? m : null;
  });

  constructor() {
    void this.plan.asegurar();
  }

  private calcular(): MensajePlan | null {
    const s = this.suscripcion();
    // Con la decisión pendiente manda la pasarela (app-decision-plan).
    if (!s || s.pendienteDecision) return null;
    const dias = s.diasRestantes ?? 0;
    if (s.estado === 'PRUEBA' && dias <= DIAS_AVISO_PLAN) {
      return {
        tipo: 'PRUEBA',
        urgente: dias <= 5,
        icono: 'fa-solid fa-gift',
        texto: `Tu prueba gratuita termina en ${dias} día(s). Si no eliges un plan, quedas en el plan Gratis con todos tus datos.`,
      };
    }
    if (s.estado === 'ACTIVA' && dias <= DIAS_AVISO_PLAN) {
      return { tipo: 'ACTIVA', urgente: dias <= 5, icono: 'fa-solid fa-crown', texto: `Tu plan ${s.nombrePlan} vence en ${dias} día(s). Renuévalo para no bajar al plan Gratis.` };
    }
    const gratis = recordatorioGratis(s);
    if (gratis) {
      return { tipo: `GRATIS_${gratis.nivel}`, urgente: gratis.nivel !== 'NORMAL', icono: 'fa-solid fa-seedling', texto: gratis.texto };
    }
    return null;
  }

  protected ocultar(tipo: string): void {
    const hasta = new Date();
    if (tipo === 'GRATIS_NORMAL') {
      hasta.setDate(hasta.getDate() + DIAS_OCULTAR_RECORDATORIO_GRATIS);
    } else {
      hasta.setHours(24, 0, 0, 0);
    }
    const ocultos = { ...this.ocultos(), [tipo]: hasta.getTime() };
    try {
      localStorage.setItem(CLAVE_OCULTO, JSON.stringify(ocultos));
    } catch {
      // Sin almacenamiento: solo se oculta en esta vista.
    }
    this.ocultos.set(ocultos);
  }
}

function estaOculto(ocultos: Record<string, number>, tipo: string): boolean {
  return (ocultos[tipo] ?? 0) > Date.now();
}

function leerOcultos(): Record<string, number> {
  try {
    const valor = JSON.parse(localStorage.getItem(CLAVE_OCULTO) ?? '{}') as unknown;
    return valor && typeof valor === 'object' ? (valor as Record<string, number>) : {};
  } catch {
    return {};
  }
}
