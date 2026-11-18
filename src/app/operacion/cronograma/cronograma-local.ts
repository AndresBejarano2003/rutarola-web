import { Injectable, inject } from '@angular/core';
import { Observable, defer, forkJoin, map } from 'rxjs';
import { FILTROS_FACTURA_VACIOS } from 'src/app/finanzas/facturas/factura';
import { FacturasRepositorio } from 'src/app/finanzas/facturas/facturas-repositorio';
import { FILTROS_PROGRAMACION_VACIOS } from 'src/app/finanzas/programacion/programacion';
import { ProgramacionesRepositorio } from 'src/app/finanzas/programacion/programaciones-repositorio';
import { FILTROS_RECIBO_VACIOS } from 'src/app/finanzas/recibos/recibo';
import { RecibosRepositorio } from 'src/app/finanzas/recibos/recibos-repositorio';
import { FILTROS_ASIGNACION_VACIOS } from 'src/app/operacion/asignaciones/asignacion';
import { AsignacionesRepositorio } from 'src/app/operacion/asignaciones/asignaciones-repositorio';
import { FILTROS_COLEGIO_VACIOS } from 'src/app/operacion/colegios/colegio';
import { ColegiosRepositorio } from 'src/app/operacion/colegios/colegios-repositorio';
import { FILTROS_RUTA_VACIOS } from 'src/app/operacion/rutas/ruta';
import { RutasRepositorio } from 'src/app/operacion/rutas/rutas-repositorio';
import { FILTROS_VEHICULO_VACIOS } from 'src/app/operacion/vehiculos/vehiculo';
import { VehiculosRepositorio } from 'src/app/operacion/vehiculos/vehiculos-repositorio';
import { FILTROS_EMPLEADO_VACIOS } from 'src/app/personas/empleados/empleado';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { leerAvisos, publico } from 'src/app/ruta-del-dia/avisos-ausencia';
import { Recorrido } from 'src/app/ruta-del-dia/recorrido';
import { CLAVE_RECORRIDOS } from 'src/app/ruta-del-dia/recorridos-local';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { SIN_PAGINAR, responderLocal, LATENCIA_LOCAL } from 'src/app/shared/crud/repositorio-local';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { DatosCronograma, calcularCronograma, calcularDiaCronograma } from './calcular-cronograma';
import { Cronograma, DIAS_MAXIMOS_CRONOGRAMA, DetalleDiaCronograma } from './cronograma';
import { CronogramaRepositorio } from './cronograma-repositorio';

/** TEMPORAL (modo local y pruebas): arma el cronograma con los registros del navegador y `calcular-cronograma.ts`. */
@Injectable()
export class CronogramaLocal extends CronogramaRepositorio {
  readonly modoLocal = true as const;
  private readonly latenciaMs = inject(LATENCIA_LOCAL);
  private readonly rutas = inject(RutasRepositorio);
  private readonly asignaciones = inject(AsignacionesRepositorio);
  private readonly vehiculos = inject(VehiculosRepositorio);
  private readonly empleados = inject(EmpleadosRepositorio);
  private readonly colegios = inject(ColegiosRepositorio);
  private readonly facturas = inject(FacturasRepositorio);
  private readonly recibos = inject(RecibosRepositorio);
  private readonly programaciones = inject(ProgramacionesRepositorio);

  obtener(desde: string, hasta: string): Observable<Cronograma> {
    return defer(() => {
      validarRango(desde, hasta);
      return this.datos().pipe(map((d) => calcularCronograma(d, desde, hasta)));
    });
  }

  dia(fecha: string): Observable<DetalleDiaCronograma> {
    return this.datos().pipe(map((d) => calcularDiaCronograma(d, fecha || d.hoy)));
  }

  private datos(): Observable<DatosCronograma> {
    const items = <T>(o: Observable<{ items: T[] }>) => o.pipe(map((p) => p.items));
    return forkJoin({
      rutas: items(this.rutas.listar(FILTROS_RUTA_VACIOS, SIN_PAGINAR)),
      asignaciones: items(this.asignaciones.listar(FILTROS_ASIGNACION_VACIOS, SIN_PAGINAR)),
      vehiculos: items(this.vehiculos.listar(FILTROS_VEHICULO_VACIOS, SIN_PAGINAR)),
      empleados: items(this.empleados.listar(FILTROS_EMPLEADO_VACIOS, SIN_PAGINAR)),
      colegios: items(this.colegios.listar(FILTROS_COLEGIO_VACIOS, SIN_PAGINAR)),
      facturas: items(this.facturas.listar(FILTROS_FACTURA_VACIOS, SIN_PAGINAR)),
      recibos: items(this.recibos.listar(FILTROS_RECIBO_VACIOS, SIN_PAGINAR)),
      programaciones: items(this.programaciones.listar(FILTROS_PROGRAMACION_VACIOS, SIN_PAGINAR)),
      locales: responderLocal(() => ({ recorridos: leerRecorridos(), avisos: leerAvisos().map(publico) }), this.latenciaMs),
    }).pipe(map(({ locales, ...resto }) => ({ ...resto, ...locales, hoy: fechaIso() })));
  }
}

function validarRango(desde: string, hasta: string): void {
  if (!desde || !hasta) throw new ErrorCrud('Indica el rango de fechas.', 'VALIDACION');
  if (hasta < desde) throw new ErrorCrud('La fecha final debe ser igual o posterior a la inicial.', 'VALIDACION');
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1;
  if (dias > DIAS_MAXIMOS_CRONOGRAMA) throw new ErrorCrud('Elige un rango de máximo un año.', 'VALIDACION');
}

function leerRecorridos(): Recorrido[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_RECORRIDOS) ?? '[]') as Recorrido[];
  } catch {
    return [];
  }
}
