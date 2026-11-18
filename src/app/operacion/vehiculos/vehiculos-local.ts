import { Injectable, Injector, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { DatosRegistro, ErrorCrud } from 'src/app/shared/crud/crud';
import { RepositorioLocal } from 'src/app/shared/crud/repositorio-local';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { FILTROS_ASIGNACION_VACIOS } from '../asignaciones/asignacion';
import { AsignacionesRepositorio } from '../asignaciones/asignaciones-repositorio';
import { FILTROS_VEHICULO_VACIOS, FiltrosVehiculo, Vehiculo, etiquetaVehiculo } from './vehiculo';
import { VehiculosRepositorio } from './vehiculos-repositorio';
import { FILTROS_GASTO_VACIOS } from './gastos-vehiculo/gasto-vehiculo';
import { GastosVehiculoRepositorio } from './gastos-vehiculo/gastos-vehiculo-repositorio';

/** Almacenamiento TEMPORAL en `localStorage` mientras se construye el API. */
@Injectable()
export class VehiculosLocal extends RepositorioLocal<Vehiculo, FiltrosVehiculo> implements VehiculosRepositorio {
  protected readonly clave = 'rutarola.vehiculos';
  protected readonly filtrosVacios = FILTROS_VEHICULO_VACIOS;
  private readonly injector = inject(Injector);

  protected coincide(v: Vehiculo, f: FiltrosVehiculo): boolean {
    const texto = normalizar(f.texto);
    return (
      (!texto || normalizar(`${v.placa} ${v.numeroInterno} ${v.marca} ${v.linea}`).includes(texto)) &&
      (!f.tipo || v.tipo === f.tipo) &&
      (!f.estado || v.estado === f.estado)
    );
  }

  protected etiquetaOpcion(v: Vehiculo): string {
    return etiquetaVehiculo(v);
  }

  protected override ordenar(a: Vehiculo, b: Vehiculo): number {
    return a.numeroInterno.localeCompare(b.numeroInterno, 'es', { numeric: true });
  }

  protected override validar(datos: DatosRegistro<Vehiculo>, idActual: string | null, registros: Vehiculo[]): void {
    const otros = registros.filter((r) => r.id !== idActual);
    if (otros.some((r) => r.placa === datos.placa)) {
      throw new ErrorCrud(`Ya existe un vehículo con la placa ${datos.placa}.`, 'DUPLICADO');
    }
    if (otros.some((r) => r.numeroInterno === datos.numeroInterno)) {
      throw new ErrorCrud(`El número interno ${datos.numeroInterno} ya está asignado a otro vehículo.`, 'DUPLICADO');
    }
  }

  override motivoNoEliminar(id: string): Observable<string | null> {
    return this.injector
      .get(AsignacionesRepositorio)
      .listar({ ...FILTROS_ASIGNACION_VACIOS, vehiculoId: id }, { pagina: 1, tamano: 1 })
      .pipe(
        switchMap(({ total }) =>
          total
            ? of(`No se puede eliminar: el vehículo tiene ${total} asignación(es) de ruta. Cámbialo a Inactivo para conservar el historial.`)
            : this.injector
                .get(GastosVehiculoRepositorio)
                .listar({ ...FILTROS_GASTO_VACIOS, vehiculoId: id }, { pagina: 1, tamano: 1 })
                .pipe(
                  map(({ total: gastos }) =>
                    gastos
                      ? `No se puede eliminar: el vehículo tiene ${gastos} gasto(s) registrado(s). Cámbialo a Inactivo para conservar el historial.`
                      : null,
                  ),
                ),
        ),
      );
  }

  protected datosIniciales(): Vehiculo[] {
    const enDias = (dias: number) => fechaIso(new Date(Date.now() + dias * 86_400_000));
    const vehiculo = (
      id: string,
      placa: string,
      numeroInterno: string,
      tipo: Vehiculo['tipo'],
      [marca, linea, modelo]: [string, string, number],
      capacidad: number,
      [soat, tecno, tarjeta, polizas]: [number, number, number, number],
      estado: Vehiculo['estado'] = 'ACTIVO',
    ): Vehiculo => ({
      id,
      placa,
      numeroInterno,
      tipo,
      marca,
      linea,
      modelo,
      color: 'Amarillo',
      capacidad,
      vencimientoSoat: enDias(soat),
      vencimientoTecnomecanica: enDias(tecno),
      vencimientoTarjetaOperacion: enDias(tarjeta),
      vencimientoPolizas: enDias(polizas),
      estado,
      observaciones: '',
      fechaCreacion: '2026-01-08T08:00:00.000Z',
      fechaActualizacion: '2026-01-08T08:00:00.000Z',
    });
    return [
      vehiculo('veh-1', 'WTN482', '101', 'BUSETA', ['Chevrolet', 'NPR', 2021], 19, [210, 150, 300, 210]),
      vehiculo('veh-2', 'SXK915', '102', 'BUS', ['Hino', 'FC9J', 2019], 32, [90, 18, 240, 90]),
      vehiculo('veh-3', 'TMP307', '103', 'MICROBUS', ['Mercedes-Benz', 'Sprinter', 2022], 15, [300, 280, 330, 300]),
      vehiculo('veh-4', 'UFZ624', '104', 'BUSETA', ['Volkswagen', 'Delivery', 2018], 20, [-10, 60, 120, 120]),
      vehiculo('veh-5', 'QHL158', '105', 'CAMIONETA', ['Toyota', 'Hiace', 2016], 12, [40, 40, 40, 40], 'INACTIVO'),
    ];
  }
}
