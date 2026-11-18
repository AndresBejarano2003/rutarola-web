import { Injectable, Injector, inject } from '@angular/core';
import { Observable, defer, map } from 'rxjs';
import { ValidacionCodigo, evaluarCodigo } from 'src/app/plataforma/codigos-promocionales/codigo-promocional';
import { CodigosPromocionalesRepositorio } from 'src/app/plataforma/codigos-promocionales/codigos-promocionales-repositorio';
import { FILTROS_CODIGO_VACIOS } from 'src/app/plataforma/codigos-promocionales/codigo-promocional';
import { SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { FuenteLocal, LATENCIA_LOCAL, responderLocal } from 'src/app/shared/crud/repositorio-local';
import {
  CLAVE_DIAS_AVISO_VENCIMIENTO,
  CLAVE_DIAS_PRUEBA,
  DIAS_AVISO_VENCIMIENTO_POR_DEFECTO,
  DIAS_PRUEBA_POR_DEFECTO,
  MESES_PAGADOS_POR_ANIO,
  AjusteSuscripcion,
  Checkout,
  CondicionesRegistro,
  PLANES,
  PagoSuscripcion,
  ParametroPlataforma,
  PeriodoPago,
  Plan,
  PlanSuscripcion,
  Suscripcion,
  clavePrecio,
  conPrecios,
  diasHastaFin,
  planVencido,
} from './suscripcion';
import { SuscripcionRepositorio } from './suscripcion-repositorio';

/** Suscripción local (exportada para las pruebas). */
export const CLAVE_SUSCRIPCION_LOCAL = 'rutarola.suscripcion';
const CLAVE = CLAVE_SUSCRIPCION_LOCAL;
const CLAVE_PARAMETROS = 'rutarola.parametros-plataforma';
/** Pagos registrados a mano por la plataforma en este navegador (los lee `IngresosLocal`). */
export const CLAVE_PAGOS_LOCAL = 'rutarola.pagos-suscripcion';

export function leerPagosLocales(): PagoSuscripcion[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PAGOS_LOCAL) ?? '[]') as PagoSuscripcion[];
  } catch {
    return [];
  }
}

type DefinicionParametro = Omit<ParametroPlataforma, 'valor'> & { porDefecto: number };

/** Igual que `ServicioParametrosPlataforma`: días de prueba y de aviso, y el valor mensual de cada plan pagado. */
const PARAMETROS: DefinicionParametro[] = [
  {
    clave: CLAVE_DIAS_PRUEBA,
    nombre: 'Días de prueba gratuita',
    descripcion:
      'Días del plan Profesional que recibe una empresa al registrarse. Solo aplica a las empresas nuevas: las que ya tienen su prueba conservan los días que recibieron.',
    minimo: 1,
    maximo: 90,
    porDefecto: DIAS_PRUEBA_POR_DEFECTO,
    tipo: 'DIAS',
    grupo: 'MEMBRESIAS',
  },
  {
    clave: CLAVE_DIAS_AVISO_VENCIMIENTO,
    nombre: 'Días de aviso antes del vencimiento',
    descripcion:
      'Desde cuántos días antes de que termine el plan pagado o la prueba se avisa a todos los administradores de la empresa (campana y correo). Si no paga, el día siguiente al vencimiento queda en el plan Gratis.',
    minimo: 1,
    maximo: 60,
    porDefecto: DIAS_AVISO_VENCIMIENTO_POR_DEFECTO,
    tipo: 'DIAS',
    grupo: 'MEMBRESIAS',
  },
  ...PLANES.filter((p) => p.precioMensual > 0).map(
    (p): DefinicionParametro => ({
      clave: clavePrecio(p.id),
      nombre: `Plan ${p.nombre}: valor mensual`,
      descripcion: `Pesos con IVA. El anual equivale a ${MESES_PAGADOS_POR_ANIO} mensualidades. Aplica a los pagos que se hagan desde ahora; los planes ya pagados no cambian.`,
      minimo: 1_000,
      maximo: 100_000_000,
      porDefecto: p.precioMensual,
      tipo: 'PESOS',
      grupo: 'PRECIOS',
    }),
  ),
];

function leerParametros(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PARAMETROS) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/** Valor vigente del parámetro (el guardado si es válido; si no, el de por defecto). */
export function parametroLocal(clave: string): number {
  const d = PARAMETROS.find((p) => p.clave === clave);
  if (!d) return 0;
  const n = Number(leerParametros()[clave]);
  return Number.isInteger(n) && n >= d.minimo && n <= d.maximo ? n : d.porDefecto;
}

function leerDiasPrueba(): number {
  return parametroLocal(CLAVE_DIAS_PRUEBA);
}

/** Los planes con los precios que fijó la plataforma en este navegador. */
export function planesLocales(): Plan[] {
  return conPrecios(Object.fromEntries(PLANES.map((p) => [p.id, parametroLocal(clavePrecio(p.id))])));
}

function aDto(d: DefinicionParametro): ParametroPlataforma {
  const { porDefecto: _porDefecto, ...resto } = d;
  return { ...resto, valor: String(parametroLocal(d.clave)) };
}

/**
 * TEMPORAL (modo local y pruebas): la prueba de Profesional del navegador; sin pagos en línea (requieren el API).
 * El uso se cuenta con los registros locales. Mismas reglas de vencimiento que el API: al día siguiente del último día
 * queda en Gratis e inactiva en el navegador los vehículos y estudiantes que sobran.
 */
@Injectable()
export class SuscripcionLocal extends SuscripcionRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly latenciaMs = inject(LATENCIA_LOCAL);
  // Perezoso: el repositorio de códigos se resuelve al validar.
  private readonly injector = inject(Injector);

  planes(): Observable<Plan[]> {
    return defer(() => responderLocal(() => planesLocales(), this.latenciaMs));
  }

  actual(): Observable<Suscripcion> {
    return defer(() => responderLocal(() => this.leer(), this.latenciaMs));
  }

  pagos(): Observable<PagoSuscripcion[]> {
    return defer(() => responderLocal(() => [...leerPagosLocales()].reverse(), this.latenciaMs));
  }

  /** Mismas reglas del API con los códigos del navegador (sin pagos locales, ninguna empresa los ha usado aún). */
  validarCodigo(codigo: string, plan: PlanSuscripcion, periodo: PeriodoPago): Observable<ValidacionCodigo> {
    return this.injector
      .get(CodigosPromocionalesRepositorio)
      .listar(FILTROS_CODIGO_VACIOS, SIN_PAGINAR)
      .pipe(
        map((pagina) =>
          evaluarCodigo(pagina.items, codigo, planesLocales().find((p) => p.id === plan) ?? PLANES[0], periodo, {
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
    return defer(() =>
      responderLocal(
        () => ({
          diasPrueba: leerDiasPrueba(),
          planPrueba: 'PROFESIONAL' as const,
          nombrePlanPrueba: 'Profesional',
          diasAvisoVencimiento: parametroLocal(CLAVE_DIAS_AVISO_VENCIMIENTO),
        }),
        this.latenciaMs,
      ),
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
    return defer(() => responderLocal(() => PARAMETROS.map(aDto), this.latenciaMs));
  }

  actualizarParametroPlataforma(clave: string, valor: string): Observable<ParametroPlataforma> {
    return defer(() =>
      responderLocal(() => {
        const d = PARAMETROS.find((p) => p.clave === clave);
        if (!d) throw new ErrorCrud('El parámetro no existe.', 'NO_ENCONTRADO');
        const n = Number(valor);
        if (!Number.isInteger(n) || n < d.minimo || n > d.maximo) {
          throw new ErrorCrud(`El valor debe ser un número entre ${d.minimo} y ${d.maximo}.`, 'VALIDACION');
        }
        localStorage.setItem(CLAVE_PARAMETROS, JSON.stringify({ ...leerParametros(), [clave]: String(n) }));
        return aDto(d);
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
        if (a.fechaFin && planVencido({ estado: a.estado, fechaFin: new Date(a.fechaFin).toISOString() })) {
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
          planVencido: a.estado === 'ACTIVA' ? '' : this.leer().planVencido,
        };
        inactivarSobrantes('rutarola.vehiculos', plan.limites.vehiculos, () => '');
        inactivarSobrantes('rutarola.estudiantes', plan.limites.estudiantes, () => '');
        this.guardar(s);
        const valor = Math.round(a.valorPagado ?? 0);
        if (a.estado === 'ACTIVA' && valor > 0) {
          const ahora = new Date().toISOString();
          const pago: PagoSuscripcion = {
            id: crypto.randomUUID(),
            referencia: `MAN-${Date.now().toString(36).toUpperCase()}`,
            plan: plan.id,
            periodo: s.periodo || 'MENSUAL',
            valor,
            estado: 'APROBADO',
            metodoPago: 'MANUAL',
            idTransaccion: '',
            fechaCreacion: ahora,
            fechaAplicacion: ahora,
            codigoPromocional: a.codigoPromocional ?? '',
            descuento: 0,
          };
          localStorage.setItem(CLAVE_PAGOS_LOCAL, JSON.stringify([...leerPagosLocales(), pago]));
        }
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
    // Suscripciones guardadas cuando se pedía decidir: quedan en Gratis con sus límites.
    const guardada = s as Suscripcion & { pendienteDecision?: boolean };
    if (guardada.pendienteDecision) {
      const { pendienteDecision: _pendiente, ...resto } = guardada;
      s = resto;
      inactivarSobrantes('rutarola.vehiculos', PLANES[0].limites.vehiculos, () => '');
      inactivarSobrantes('rutarola.estudiantes', PLANES[0].limites.estudiantes, () => '');
      this.guardar(s);
    }
    // Pasó su último día sin pago: queda en Gratis e inactiva lo que sobra.
    if (planVencido(s)) {
      const gratis = PLANES[0];
      inactivarSobrantes('rutarola.vehiculos', gratis.limites.vehiculos, () => '');
      inactivarSobrantes('rutarola.estudiantes', gratis.limites.estudiantes, () => '');
      s = {
        ...s,
        planVencido: s.plan,
        fechaVencimiento: s.fechaFin,
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
    const dias = s.fechaFin ? diasHastaFin(s.fechaFin) : null;
    // Suscripciones guardadas antes de estos campos.
    const anteriores: Pick<Suscripcion, 'planVencido' | 'fechaVencimiento' | 'diasPrueba'> = {
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
    planVencido: '',
    fechaVencimiento: null,
    diasPrueba,
  };
}
