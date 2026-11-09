import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { iniciales, nombreCompleto } from 'src/app/personas/compartido/persona';
import { FILTROS_EMPLEADO_VACIOS } from 'src/app/personas/empleados/empleado';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { aMapa } from 'src/app/shared/catalogos/catalogos';
import { Pagina, Paginacion } from 'src/app/shared/crud/crud';
import { FuenteLocal, SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { estadoVencimiento } from 'src/app/shared/vencimiento/vencimiento';
import { FILTROS_ASIGNACION_VACIOS } from '../asignaciones/asignacion';
import { AsignacionesRepositorio } from '../asignaciones/asignaciones-repositorio';
import { FILTROS_RUTA_VACIOS, etiquetaRuta } from '../rutas/ruta';
import { RutasRepositorio } from '../rutas/rutas-repositorio';
import { VehiculosRepositorio } from '../vehiculos/vehiculos-repositorio';
import { ConductorOperacion, FiltrosConductor } from './conductor';
import { ConductoresRepositorio } from './conductores-repositorio';

/** Combina empleados, asignaciones, rutas y vehículos locales (lo que haría el API). */
@Injectable()
export class ConductoresLocal extends ConductoresRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly empleados = inject(EmpleadosRepositorio);
  private readonly asignaciones = inject(AsignacionesRepositorio);
  private readonly rutas = inject(RutasRepositorio);
  private readonly vehiculos = inject(VehiculosRepositorio);

  listar(f: FiltrosConductor, { pagina, tamano }: Paginacion): Observable<Pagina<ConductorOperacion>> {
    return forkJoin([
      this.empleados.listar({ ...FILTROS_EMPLEADO_VACIOS, tipoEmpleado: 'CONDUCTOR' }, SIN_PAGINAR),
      this.empleados.opciones({ tipoEmpleado: 'MONITORA' }),
      this.asignaciones.listar({ ...FILTROS_ASIGNACION_VACIOS, estado: 'ACTIVO' }, SIN_PAGINAR),
      this.rutas.listar(FILTROS_RUTA_VACIOS, SIN_PAGINAR),
      this.vehiculos.opciones(),
    ]).pipe(
      map(([conductores, monitoras, asignaciones, rutas, vehiculos]) => {
        const rutaPorId = new Map(rutas.items.map((r) => [r.id, r]));
        const vehiculoPorId = aMapa(vehiculos);
        const monitoraPorId = aMapa(monitoras);
        const texto = normalizar(f.texto);
        const todos = conductores.items
          .map((e): ConductorOperacion => {
            const a = asignaciones.items.find((x) => x.conductorId === e.id);
            const ruta = a ? rutaPorId.get(a.rutaId) : undefined;
            return {
              id: e.id,
              nombre: nombreCompleto(e),
              iniciales: iniciales(e),
              foto: e.foto ?? '',
              documento: `${e.tipoDocumento} ${e.numeroDocumento}`,
              telefono: e.telefono,
              correo: e.correo,
              numeroLicencia: e.numeroLicencia,
              categoriaLicencia: e.categoriaLicencia,
              vencimientoLicencia: e.vencimientoLicencia,
              estadoLicencia: estadoVencimiento(e.vencimientoLicencia),
              estado: e.estado,
              asignacion: a
                ? {
                    id: a.id,
                    ruta: ruta ? etiquetaRuta(ruta) : a.rutaId,
                    jornada: ruta?.jornada ?? '',
                    vehiculo: vehiculoPorId.get(a.vehiculoId) ?? '',
                    monitora: a.monitoraId ? (monitoraPorId.get(a.monitoraId) ?? '') : '',
                  }
                : null,
            };
          })
          .filter(
            (c) =>
              (!texto || normalizar(`${c.nombre} ${c.documento} ${c.numeroLicencia}`).includes(texto)) &&
              (!f.licencia || c.estadoLicencia === f.licencia) &&
              (!f.asignacion || (f.asignacion === 'CON') === !!c.asignacion) &&
              (!f.estado || c.estado === f.estado),
          );
        const inicio = (pagina - 1) * tamano;
        return { items: todos.slice(inicio, inicio + tamano), total: todos.length, pagina, tamano };
      }),
    );
  }
}
