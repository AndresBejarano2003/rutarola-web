import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { LATENCIA_LOCAL, responderLocal } from 'src/app/shared/crud/repositorio-local';
import { CLAVE_SUSCRIPCION_LOCAL, leerPagosLocales, planesLocales } from 'src/app/sistema/membresias/suscripcion-local';
import { Suscripcion, planVencido } from 'src/app/sistema/membresias/suscripcion';
import { DIAS_MAXIMOS_INGRESOS, IngresosPlataforma, calcularIngresos, diasDelRango } from './ingresos';
import { IngresosRepositorio } from './ingresos-repositorio';

/** TEMPORAL (modo local y pruebas): los pagos que la plataforma registró a mano en este navegador (una sola empresa). */
@Injectable()
export class IngresosLocal extends IngresosRepositorio {
  readonly modoLocal = true as const;
  private readonly latenciaMs = inject(LATENCIA_LOCAL);

  obtener(desde: string, hasta: string): Observable<IngresosPlataforma> {
    return defer(() =>
      responderLocal(() => {
        if (hasta < desde) throw new ErrorCrud('La fecha final debe ser igual o posterior a la inicial.', 'VALIDACION');
        if (diasDelRango(desde, hasta) > DIAS_MAXIMOS_INGRESOS) throw new ErrorCrud('Elige un rango de máximo 3 años.', 'VALIDACION');
        const pagos = leerPagosLocales().map((p) => ({ ...p, empresaId: 'local', empresa: 'Mi empresa (modo local)' }));
        return calcularIngresos(pagos, desde, hasta, recurrente());
      }, this.latenciaMs),
    );
  }
}

function recurrente(): { mensual: number; empresas: number } {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE_SUSCRIPCION_LOCAL) ?? 'null') as Suscripcion | null;
    if (!s || s.estado !== 'ACTIVA' || planVencido(s)) return { mensual: 0, empresas: 0 };
    const plan = planesLocales().find((p) => p.id === s.plan);
    if (!plan) return { mensual: 0, empresas: 0 };
    return { mensual: s.periodo === 'ANUAL' ? Math.round(plan.precioAnual / 12) : plan.precioMensual, empresas: 1 };
  } catch {
    return { mensual: 0, empresas: 0 };
  }
}
