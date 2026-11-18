import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DatosRegistro, ErrorCrud } from 'src/app/shared/crud/crud';
import { RepositorioLocal } from 'src/app/shared/crud/repositorio-local';
import { fechaIso, sumarDias } from 'src/app/shared/fechas/fechas';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { VehiculosRepositorio } from '../vehiculos-repositorio';
import { GastosVehiculoRepositorio } from './gastos-vehiculo-repositorio';
import { FILTROS_GASTO_VACIOS, FiltrosGasto, GastoVehiculo, ResumenGastos, nombreTipoGasto, resumirGastos } from './gasto-vehiculo';

const DOS_MB = 2 * 1024 * 1024;

/** TEMPORAL (`localStorage`). Mismas validaciones que el API; el tablero se calcula con `resumirGastos`. */
@Injectable()
export class GastosVehiculoLocal extends RepositorioLocal<GastoVehiculo, FiltrosGasto> implements GastosVehiculoRepositorio {
  protected readonly clave = 'rutarola.vehiculos.gastos';
  protected readonly filtrosVacios = FILTROS_GASTO_VACIOS;
  private readonly vehiculos = inject(VehiculosRepositorio);

  protected datosIniciales(): GastoVehiculo[] {
    const hoy = fechaIso();
    const dia = (n: number) => sumarDias(hoy, -n);
    const g = (
      id: string, vehiculoId: string, vehiculo: string, tipo: GastoVehiculo['tipo'], fecha: string, valor: number,
      extra: Partial<GastoVehiculo> = {},
    ): GastoVehiculo => ({
      id, vehiculoId, vehiculo, tipo, fecha, valor, descripcion: '', proveedor: '', referencia: '', kilometraje: null,
      cantidad: null, archivo: null, fechaCreacion: `${fecha}T12:00:00.000Z`, ...extra,
    });
    const v1 = 'WTN482 · Interno 101';
    return [
      g('gas-1', 'veh-1', v1, 'COMBUSTIBLE', dia(75), 210000, { proveedor: 'Terpel Av. 26', kilometraje: 84200, cantidad: 14 }),
      g('gas-2', 'veh-1', v1, 'MANTENIMIENTO', dia(60), 380000, { descripcion: 'Cambio de aceite y filtros', proveedor: 'Taller El Pistón', kilometraje: 84900 }),
      g('gas-3', 'veh-1', v1, 'COMBUSTIBLE', dia(45), 225000, { proveedor: 'Terpel Av. 26', kilometraje: 85150, cantidad: 15 }),
      g('gas-4', 'veh-1', v1, 'PEAJE', dia(30), 24000, { descripcion: 'Salida a paseo escolar' }),
      g('gas-5', 'veh-1', v1, 'COMBUSTIBLE', dia(15), 240000, { proveedor: 'Primax Calle 80', kilometraje: 86050, cantidad: 16 }),
      g('gas-6', 'veh-1', v1, 'REPUESTO', dia(8), 160000, { descripcion: 'Pastillas de freno traseras', proveedor: 'Autopartes Bogotá', referencia: 'FV-2231' }),
      g('gas-7', 'veh-2', 'SXK915 · Interno 102', 'COMBUSTIBLE', dia(20), 180000, { kilometraje: 51200, cantidad: 12 }),
      g('gas-8', 'veh-2', 'SXK915 · Interno 102', 'LAVADO', dia(5), 35000, { proveedor: 'Lavautos La 68' }),
    ];
  }

  protected coincide(g: GastoVehiculo, f: FiltrosGasto): boolean {
    return (
      (!f.vehiculoId || g.vehiculoId === f.vehiculoId) &&
      (!f.tipo || g.tipo === f.tipo) &&
      (!f.desde || g.fecha >= f.desde) &&
      (!f.hasta || g.fecha <= f.hasta) &&
      (!f.texto || normalizar(`${g.descripcion} ${g.proveedor} ${g.referencia}`).includes(normalizar(f.texto)))
    );
  }

  protected override ordenar(a: GastoVehiculo, b: GastoVehiculo): number {
    return b.fecha.localeCompare(a.fecha) || (b.fechaCreacion ?? '').localeCompare(a.fechaCreacion ?? '');
  }

  protected etiquetaOpcion(g: GastoVehiculo): string {
    return `${nombreTipoGasto(g.tipo)} · ${g.fecha}`;
  }

  protected override validar(d: DatosRegistro<GastoVehiculo>): void {
    if (!d.vehiculoId) throw new ErrorCrud('Elige el vehículo.', 'VALIDACION');
    if (!d.fecha) throw new ErrorCrud('Ingresa la fecha del gasto.', 'VALIDACION');
    if (d.fecha > fechaIso()) throw new ErrorCrud('La fecha del gasto no puede ser futura.', 'VALIDACION');
    if (!(d.valor > 0)) throw new ErrorCrud('El valor debe ser mayor que cero.', 'VALIDACION');
    if (d.tipo === 'COMBUSTIBLE' && !d.cantidad) throw new ErrorCrud('Ingresa los galones tanqueados.', 'VALIDACION');
    if (d.archivo && d.archivo.tamano > DOS_MB) throw new ErrorCrud('El archivo supera 2 MB.', 'VALIDACION');
  }

  /** El vehículo debe existir; guarda su placa como la muestra el API. */
  protected override validarRelaciones(d: DatosRegistro<GastoVehiculo>): Observable<unknown> {
    return this.vehiculos.obtener(d.vehiculoId).pipe(map((v) => this.placas.set(v.id, `${v.placa} · Interno ${v.numeroInterno}`)));
  }

  private readonly placas = new Map<string, string>();

  protected override preparar(d: DatosRegistro<GastoVehiculo>, idActual: string | null, registros: GastoVehiculo[]): DatosRegistro<GastoVehiculo> {
    const actual = idActual ? registros.find((r) => r.id === idActual) : undefined;
    const archivo = d.archivo === null ? null : d.archivo.url.startsWith('data:') ? d.archivo : (actual?.archivo ?? null);
    return {
      ...d,
      vehiculo: this.placas.get(d.vehiculoId) ?? d.vehiculo,
      descripcion: d.descripcion.trim(),
      proveedor: d.proveedor.trim(),
      referencia: d.referencia.trim(),
      archivo,
    };
  }

  resumen(filtros: FiltrosGasto): Observable<ResumenGastos> {
    return this.responder(() => resumirGastos(this.leer().filter((g) => this.coincide(g, filtros))));
  }
}
