import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { FuenteLocal, LATENCIA_LOCAL, responderLocal } from 'src/app/shared/crud/repositorio-local';
import { MESES_PRUEBA, AjusteSuscripcion, Checkout, PLANES, PagoSuscripcion, Plan, Suscripcion } from './suscripcion';
import { SuscripcionRepositorio } from './suscripcion-repositorio';

const CLAVE = 'rutarola.suscripcion';

/**
 * TEMPORAL (modo local y pruebas): la prueba de Profesional del navegador; sin pagos en línea (requieren el API).
 * El uso se cuenta con los registros locales.
 */
@Injectable()
export class SuscripcionLocal extends SuscripcionRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly latenciaMs = inject(LATENCIA_LOCAL);

  planes(): Observable<Plan[]> {
    return defer(() => responderLocal(() => PLANES, this.latenciaMs));
  }

  actual(): Observable<Suscripcion> {
    return defer(() => responderLocal(() => this.leer(), this.latenciaMs));
  }

  pagos(): Observable<PagoSuscripcion[]> {
    return defer(() => responderLocal(() => [], this.latenciaMs));
  }

  iniciarPago(): Observable<Checkout> {
    return defer(() =>
      responderLocal(() => {
        throw new ErrorCrud('Los pagos en línea requieren el servidor (modo local).', 'VALIDACION');
      }, this.latenciaMs),
    );
  }

  verificarPago(): Observable<PagoSuscripcion> {
    return defer(() =>
      responderLocal(() => {
        throw new ErrorCrud('El pago no existe.', 'NO_ENCONTRADO');
      }, this.latenciaMs),
    );
  }

  deEmpresa(): Observable<Suscripcion> {
    return this.actual();
  }

  pagosDeEmpresa(): Observable<PagoSuscripcion[]> {
    return this.pagos();
  }

  ajustar(_empresaId: string, a: AjusteSuscripcion): Observable<Suscripcion> {
    return defer(() =>
      responderLocal(() => {
        if (a.fechaFin && new Date(a.fechaFin).getTime() <= Date.now()) {
          throw new ErrorCrud('La fecha de vencimiento debe ser futura.', 'VALIDACION');
        }
        const plan = PLANES.find((p) => p.id === a.plan) ?? PLANES[0];
        const s: Suscripcion = {
          ...this.leer(),
          plan: plan.id,
          nombrePlan: plan.nombre,
          estado: a.estado,
          periodo: a.estado === 'ACTIVA' ? a.periodo || 'MENSUAL' : '',
          fechaFin: a.estado === 'GRATIS' ? null : new Date(a.fechaFin).toISOString(),
          limites: plan.limites,
          funciones: plan.funciones,
          nota: a.nota.trim(),
        };
        localStorage.setItem(CLAVE, JSON.stringify(s));
        return this.leer();
      }, this.latenciaMs),
    );
  }

  private leer(): Suscripcion {
    let s: Suscripcion | null = null;
    try {
      s = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Suscripcion | null;
    } catch {
      s = null;
    }
    if (!s) {
      const ahora = new Date();
      const fin = new Date(ahora);
      fin.setMonth(fin.getMonth() + MESES_PRUEBA);
      const plan = PLANES.find((p) => p.id === 'PROFESIONAL')!;
      s = {
        plan: plan.id,
        nombrePlan: plan.nombre,
        estado: 'PRUEBA',
        periodo: '',
        fechaInicio: ahora.toISOString(),
        fechaFin: fin.toISOString(),
        diasRestantes: null,
        pruebaUsada: true,
        limites: plan.limites,
        uso: { vehiculos: 0, estudiantes: 0 },
        funciones: plan.funciones,
        pagosEnLinea: false,
        nota: '',
      };
      localStorage.setItem(CLAVE, JSON.stringify(s));
    }
    const dias = s.fechaFin ? Math.max(0, Math.ceil((new Date(s.fechaFin).getTime() - Date.now()) / 86_400_000)) : null;
    return { ...s, diasRestantes: dias, uso: { vehiculos: contar('rutarola.vehiculos'), estudiantes: contar('rutarola.estudiantes') } };
  }
}

function contar(clave: string): number {
  try {
    const lista = JSON.parse(localStorage.getItem(clave) ?? '[]') as { estado?: string }[];
    return lista.filter((x) => x.estado === 'ACTIVO').length;
  } catch {
    return 0;
  }
}
