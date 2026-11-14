import { Injectable, Injector, inject } from '@angular/core';
import { Observable, defer, map } from 'rxjs';
import { ValidacionCodigo, evaluarCodigo } from 'src/app/plataforma/codigos-promocionales/codigo-promocional';
import { CodigosPromocionalesRepositorio } from 'src/app/plataforma/codigos-promocionales/codigos-promocionales-repositorio';
import { FILTROS_CODIGO_VACIOS } from 'src/app/plataforma/codigos-promocionales/codigo-promocional';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { FuenteLocal, LATENCIA_LOCAL, responderLocal } from 'src/app/shared/crud/repositorio-local';
import {
  CLAVE_DIAS_PRUEBA,
  DIAS_PRUEBA_POR_DEFECTO,
  AjusteSuscripcion,
  Checkout,
  CondicionesRegistro,
  DecisionGratis,
  PLANES,
  PagoSuscripcion,
  ParametroPlataforma,
  PeriodoPago,
  Plan,
  PlanSuscripcion,
  Suscripcion,
} from './suscripcion';
import { SuscripcionRepositorio } from './suscripcion-repositorio';

/** Suscripción local (exportada para las pruebas). */
export const CLAVE_SUSCRIPCION_LOCAL = 'rutarola.suscripcion';
const CLAVE = CLAVE_SUSCRIPCION_LOCAL;
const CLAVE_PARAMETROS = 'rutarola.parametros-plataforma';

/** Igual que `ServicioParametrosPlataforma`: los días de prueba de las empresas nuevas. */
function parametroDiasPrueba(valor: string): ParametroPlataforma {
  return {
    clave: CLAVE_DIAS_PRUEBA,
    nombre: 'Días de prueba gratuita',
    descripcion:
      'Días del plan Profesional que recibe una empresa al registrarse. Solo aplica a las empresas nuevas: las que ya tienen su prueba conservan los días que recibieron.',
    valor,
    minimo: 1,
    maximo: 90,
  };
}

function leerDiasPrueba(): number {
  try {
    const n = Number((JSON.parse(localStorage.getItem(CLAVE_PARAMETROS) ?? '{}') as Record<string, string>)[CLAVE_DIAS_PRUEBA]);
    return Number.isInteger(n) && n >= 1 && n <= 90 ? n : DIAS_PRUEBA_POR_DEFECTO;
  } catch {
    return DIAS_PRUEBA_POR_DEFECTO;
  }
}

/**
 * TEMPORAL (modo local y pruebas): la prueba de Profesional del navegador; sin pagos en línea (requieren el API).
 * El uso se cuenta con los registros locales. Mismas reglas de vencimiento que el API: al vencer queda en Gratis con la
 * decisión pendiente, y "Continuar con Gratis" inactiva en el navegador los vehículos y estudiantes que sobran.
 */
@Injectable()
export class SuscripcionLocal extends SuscripcionRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly latenciaMs = inject(LATENCIA_LOCAL);
  // Perezoso: el repositorio de códigos se resuelve al validar.
  private readonly injector = inject(Injector);

  planes(): Observable<Plan[]> {
    return defer(() => responderLocal(() => PLANES, this.latenciaMs));
  }

  actual(): Observable<Suscripcion> {
    return defer(() => responderLocal(() => this.leer(), this.latenciaMs));
  }

  pagos(): Observable<PagoSuscripcion[]> {
    return defer(() => responderLocal(() => [], this.latenciaMs));
  }

  /** Mismas reglas del API con los códigos del navegador (sin pagos locales, ninguna empresa los ha usado aún). */
  validarCodigo(codigo: string, plan: PlanSuscripcion, periodo: PeriodoPago): Observable<ValidacionCodigo> {
    return this.injector
      .get(CodigosPromocionalesRepositorio)
      .listar(FILTROS_CODIGO_VACIOS, SIN_PAGINAR)
      .pipe(
        map((pagina) =>
          evaluarCodigo(pagina.items, codigo, PLANES.find((p) => p.id === plan) ?? PLANES[0], periodo, {
            empresaId: 'local',
            usosDeLaEmpresa: () => 0,
            primeraCompra: this.leer().estado !== 'ACTIVA',
          }),
        ),
      );
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

  condiciones(): Observable<CondicionesRegistro> {
    return defer(() => responderLocal(() => ({ diasPrueba: leerDiasPrueba(), planPrueba: 'PROFESIONAL' as const, nombrePlanPrueba: 'Profesional' }), this.latenciaMs));
  }

  continuarGratis(): Observable<DecisionGratis> {
    return defer(() =>
      responderLocal(() => {
        const s = this.leer();
        if (!s.pendienteDecision || s.estado !== 'GRATIS') throw new ErrorCrud('Tu plan sigue vigente: no hay nada que decidir.', 'VALIDACION');
        const gratis = PLANES[0];
        const vehiculos = inactivarSobrantes('rutarola.vehiculos', gratis.limites.vehiculos, (v) => String(v['placa'] ?? ''));
        const estudiantes = inactivarSobrantes('rutarola.estudiantes', gratis.limites.estudiantes, () => '').length;
        this.guardar({ ...s, pendienteDecision: false });
        return { suscripcion: this.leer(), inactivados: { vehiculos, estudiantes } };
      }, this.latenciaMs),
    );
  }

  iniciarPrueba(): Observable<Suscripcion> {
    return defer(() =>
      responderLocal(() => {
        const s = this.leer();
        if (s.estado !== 'GRATIS') throw new ErrorCrud('Tu empresa ya tiene un plan vigente.', 'VALIDACION');
        if (s.pruebaUsada) throw new ErrorCrud('Tu empresa ya usó la prueba gratuita. Elige un plan para mejorar tu membresía.', 'VALIDACION');
        this.guardar(nuevaPrueba(s.uso));
        return this.leer();
      }, this.latenciaMs),
    );
  }

  parametrosPlataforma(): Observable<ParametroPlataforma[]> {
    return defer(() => responderLocal(() => [parametroDiasPrueba(String(leerDiasPrueba()))], this.latenciaMs));
  }

  actualizarParametroPlataforma(clave: string, valor: string): Observable<ParametroPlataforma> {
    return defer(() =>
      responderLocal(() => {
        const n = Number(valor);
        if (clave !== CLAVE_DIAS_PRUEBA) throw new ErrorCrud('El parámetro no existe.', 'NO_ENCONTRADO');
        if (!Number.isInteger(n) || n < 1 || n > 90) throw new ErrorCrud('El valor debe ser un número entre 1 y 90.', 'VALIDACION');
        localStorage.setItem(CLAVE_PARAMETROS, JSON.stringify({ [CLAVE_DIAS_PRUEBA]: String(n) }));
        return parametroDiasPrueba(String(n));
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
          pendienteDecision: false,
          planVencido: a.estado === 'ACTIVA' ? '' : this.leer().planVencido,
        };
        inactivarSobrantes('rutarola.vehiculos', plan.limites.vehiculos, () => '');
        inactivarSobrantes('rutarola.estudiantes', plan.limites.estudiantes, () => '');
        this.guardar(s);
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
      s = nuevaPrueba();
      this.guardar(s);
    }
    // Venció: pasa a Gratis y al entrar el administrador decide si paga o sigue en Gratis.
    if (s.estado !== 'GRATIS' && (!s.fechaFin || new Date(s.fechaFin).getTime() <= Date.now())) {
      const gratis = PLANES[0];
      s = {
        ...s,
        planVencido: s.plan,
        fechaVencimiento: s.fechaFin,
        pendienteDecision: true,
        plan: gratis.id,
        nombrePlan: gratis.nombre,
        estado: 'GRATIS',
        periodo: '',
        fechaInicio: new Date().toISOString(),
        fechaFin: null,
        limites: gratis.limites,
        funciones: gratis.funciones,
      };
      this.guardar(s);
    }
    const dias = s.fechaFin ? Math.max(0, Math.ceil((new Date(s.fechaFin).getTime() - Date.now()) / 86_400_000)) : null;
    // Suscripciones guardadas antes de estos campos.
    const anteriores: Pick<Suscripcion, 'pendienteDecision' | 'planVencido' | 'fechaVencimiento' | 'diasPrueba'> = {
      pendienteDecision: false,
      planVencido: '',
      fechaVencimiento: null,
      diasPrueba: 0,
    };
    return {
      ...anteriores,
      ...s,
      diasRestantes: dias,
      uso: { vehiculos: contar('rutarola.vehiculos'), estudiantes: contar('rutarola.estudiantes') },
    };
  }

  private guardar(s: Suscripcion): void {
    localStorage.setItem(CLAVE, JSON.stringify(s));
  }
}

/** Deja activos a lo sumo `limite` registros (los más antiguos) y devuelve la etiqueta de los que inactivó. */
function inactivarSobrantes(clave: string, limite: number | null, etiqueta: (r: Record<string, unknown>) => string): string[] {
  if (limite === null) return [];
  try {
    const lista = JSON.parse(localStorage.getItem(clave) ?? '[]') as Record<string, unknown>[];
    const activos = lista
      .filter((r) => r['estado'] === 'ACTIVO')
      .sort((a, b) => String(a['fechaCreacion'] ?? '').localeCompare(String(b['fechaCreacion'] ?? '')));
    const sobran = activos.slice(limite);
    if (sobran.length === 0) return [];
    for (const r of sobran) r['estado'] = 'INACTIVO';
    localStorage.setItem(clave, JSON.stringify(lista));
    return sobran.map(etiqueta);
  } catch {
    return [];
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

/** Prueba del plan Profesional desde hoy con los días que fija la plataforma. */
function nuevaPrueba(uso: Suscripcion['uso'] = { vehiculos: 0, estudiantes: 0 }): Suscripcion {
  const ahora = new Date();
  const fin = new Date(ahora);
  const diasPrueba = leerDiasPrueba();
  fin.setDate(fin.getDate() + diasPrueba);
  const plan = PLANES.find((p) => p.id === 'PROFESIONAL')!;
  return {
    plan: plan.id,
    nombrePlan: plan.nombre,
    estado: 'PRUEBA',
    periodo: '',
    fechaInicio: ahora.toISOString(),
    fechaFin: fin.toISOString(),
    diasRestantes: null,
    pruebaUsada: true,
    limites: plan.limites,
    uso,
    funciones: plan.funciones,
    pagosEnLinea: false,
    nota: '',
    pendienteDecision: false,
    planVencido: '',
    fechaVencimiento: null,
    diasPrueba,
  };
}
