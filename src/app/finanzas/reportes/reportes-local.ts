import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { FILTROS_ACUDIENTE_VACIOS } from 'src/app/personas/acudientes/acudiente';
import { AcudientesRepositorio } from 'src/app/personas/acudientes/acudientes-repositorio';
import { FuenteLocal, SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { diasEntre, fechaIso, periodoDe, periodosEntre } from 'src/app/shared/fechas/fechas';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { cuotasFactura, pagosDeRecibos } from '../cuotas';
import { FILTROS_FACTURA_VACIOS } from '../facturas/factura';
import { FacturasRepositorio } from '../facturas/facturas-repositorio';
import { FILTROS_PROGRAMACION_VACIOS } from '../programacion/programacion';
import { ProgramacionesRepositorio } from '../programacion/programaciones-repositorio';
import { FILTROS_RECIBO_VACIOS, MEDIOS_PAGO } from '../recibos/recibo';
import { RecibosRepositorio } from '../recibos/recibos-repositorio';
import {
  CuotaPendiente,
  fechaLimiteCuota,
  FiltrosIngresos,
  FiltrosMorosos,
  FiltrosPendientes,
  Moroso,
  ReporteIngresos,
} from './reportes';
import { ReportesRepositorio } from './reportes-repositorio';

/** Calcula los reportes con los datos locales (lo que hará el API). */
@Injectable()
export class ReportesLocal extends ReportesRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly facturas = inject(FacturasRepositorio);
  private readonly recibos = inject(RecibosRepositorio);
  private readonly programaciones = inject(ProgramacionesRepositorio);
  private readonly acudientes = inject(AcudientesRepositorio);

  ingresos(f: FiltrosIngresos): Observable<ReporteIngresos> {
    return this.recibos.listar({ ...FILTROS_RECIBO_VACIOS, estado: 'ACTIVO', medioPago: f.medioPago }, SIN_PAGINAR).pipe(
      map(({ items }) => {
        const recibos = items.filter((r) => (!f.desde || r.fechaPago.slice(0, 7) >= f.desde) && (!f.hasta || r.fechaPago.slice(0, 7) <= f.hasta));
        const total = recibos.reduce((s, r) => s + r.valor, 0);
        const meses = f.desde && f.hasta ? periodosEntre(f.desde, f.hasta) : [...new Set(recibos.map((r) => r.fechaPago.slice(0, 7)))].sort();
        return {
          total,
          cantidad: recibos.length,
          promedio: recibos.length ? Math.round(total / recibos.length) : 0,
          porMes: meses.map((periodo) => {
            const delMes = recibos.filter((r) => r.fechaPago.startsWith(periodo));
            return { periodo, total: delMes.reduce((s, r) => s + r.valor, 0), cantidad: delMes.length };
          }),
          porMedio: MEDIOS_PAGO.map(({ id }) => {
            const delMedio = recibos.filter((r) => r.medioPago === id);
            return { medioPago: id, total: delMedio.reduce((s, r) => s + r.valor, 0), cantidad: delMedio.length };
          }).filter((m) => m.cantidad > 0),
          recibos,
        };
      }),
    );
  }

  pendientes(f: FiltrosPendientes): Observable<CuotaPendiente[]> {
    return this.cuotasPendientes().pipe(
      map((cuotas) => {
        const texto = normalizar(f.texto);
        return cuotas.filter(
          (c) =>
            (!texto || normalizar(`${c.numeroFactura} ${c.nombreAcudiente} ${c.nombreEstudiante}`).includes(texto)) &&
            (!f.acudienteId || c.acudienteId === f.acudienteId) &&
            (!f.situacion || (f.situacion === 'VENCIDAS') === c.diasMora > 0),
        );
      }),
    );
  }

  morosos(f: FiltrosMorosos): Observable<Moroso[]> {
    return forkJoin([this.cuotasPendientes(), this.acudientes.listar(FILTROS_ACUDIENTE_VACIOS, SIN_PAGINAR)]).pipe(
      map(([cuotas, acudientes]) => {
        const porAcudiente = new Map<string, CuotaPendiente[]>();
        for (const cuota of cuotas.filter((c) => c.diasMora > 0)) {
          porAcudiente.set(cuota.acudienteId, [...(porAcudiente.get(cuota.acudienteId) ?? []), cuota]);
        }
        const texto = normalizar(f.texto);
        return [...porAcudiente.entries()]
          .map(([acudienteId, propias]): Moroso => {
            const acudiente = acudientes.items.find((a) => a.id === acudienteId);
            return {
              acudienteId,
              nombreAcudiente: acudiente ? nombreCompleto(acudiente) : propias[0].nombreAcudiente,
              telefono: acudiente?.telefono ?? '',
              correo: acudiente?.correo ?? '',
              estudiantes: [...new Set(propias.map((c) => c.nombreEstudiante))],
              facturas: [...new Set(propias.map((c) => c.numeroFactura))],
              cuotas: propias.length,
              valorAdeudado: propias.reduce((s, c) => s + c.valor, 0),
              diasMoraMaxima: Math.max(...propias.map((c) => c.diasMora)),
              periodos: propias.map((c) => c.periodo).sort(),
            };
          })
          .filter(
            (m) =>
              m.diasMoraMaxima > (f.diasMinimos || 0) &&
              (!texto || normalizar(`${m.nombreAcudiente} ${m.estudiantes.join(' ')}`).includes(texto)),
          )
          .sort((a, b) => b.diasMoraMaxima - a.diasMoraMaxima || b.valorAdeudado - a.valorAdeudado);
      }),
    );
  }

  /** Mensualidades vencidas o del mes en curso sin recibo válido, de las facturas vigentes. */
  private cuotasPendientes(): Observable<CuotaPendiente[]> {
    return forkJoin([
      this.facturas.listar({ ...FILTROS_FACTURA_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
      this.recibos.listar({ ...FILTROS_RECIBO_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
      this.programaciones.listar(FILTROS_PROGRAMACION_VACIOS, SIN_PAGINAR),
    ]).pipe(
      map(([facturas, recibos, programaciones]) => {
        const hoy = fechaIso();
        const mesActual = periodoDe();

        const diaLimite = new Map(programaciones.items.map((p) => [p.facturaId, p.diaLimitePago]));
        return facturas.items
          .flatMap((factura) =>
            cuotasFactura(factura, pagosDeRecibos(recibos.items.filter((r) => r.facturaId === factura.id)))
              .filter((c) => c.periodo <= mesActual && c.saldo > 0)
              .map(({ periodo, valor: valorMes, pagado, saldo }): CuotaPendiente => {
                const fechaLimite = fechaLimiteCuota(periodo, diaLimite.get(factura.id));
                return {
                  facturaId: factura.id,
                  numeroFactura: factura.numero,
                  acudienteId: factura.acudienteId,
                  nombreAcudiente: factura.nombreAcudiente,
                  nombreEstudiante: factura.nombreEstudiante,
                  periodo,
                  valor: saldo,
                  fechaLimite,
                  diasMora: diasEntre(fechaLimite, hoy),
                  valorMes,
                  abonado: pagado,
                };
              }),
          )
          .sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite));
      }),
    );
  }
}
