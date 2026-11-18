import { Injectable, Injector, inject } from '@angular/core';
import { Observable, defer, firstValueFrom, from } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { FuenteLocal, LATENCIA_LOCAL, SIN_PAGINAR, responderLocal } from 'src/app/shared/crud/repositorio-local';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { FILTROS_ASIGNACION_VACIOS } from '../../asignaciones/asignacion';
import { AsignacionesRepositorio } from '../../asignaciones/asignaciones-repositorio';
import { FILTROS_VEHICULO_VACIOS } from '../vehiculo';
import { VehiculosRepositorio } from '../vehiculos-repositorio';
import {
  FiltrosNovedad,
  GRAVEDADES_NOVEDAD,
  NovedadVehiculo,
  SolicitudEstadoNovedad,
  SolicitudNovedad,
  TIPOS_NOVEDAD,
  ordenarNovedades,
} from './novedad-vehiculo';
import { NovedadesVehiculoRepositorio } from './novedades-vehiculo-repositorio';

const CLAVE = 'rutarola.vehiculos.novedades';
const DOS_MB = 2 * 1024 * 1024;

/** TEMPORAL (`localStorage`). Mismas reglas que el API; el empleado sale de la sesión. */
@Injectable()
export class NovedadesVehiculoLocal extends NovedadesVehiculoRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly latencia = inject(LATENCIA_LOCAL);

  listar(f: FiltrosNovedad): Observable<NovedadVehiculo[]> {
    return responderLocal(
      () =>
        this.leer()
          .filter((n) => (!f.vehiculoId || n.vehiculoId === f.vehiculoId) && (!f.estado || n.estado === f.estado) && (!f.abiertas || n.estado !== 'RESUELTA'))
          .sort(ordenarNovedades)
          .map((n) => this.paraLista(n)),
      this.latencia,
    );
  }

  obtener(id: string): Observable<NovedadVehiculo> {
    return responderLocal(() => this.buscar(this.leer(), id), this.latencia);
  }

  registrar(s: SolicitudNovedad): Observable<NovedadVehiculo> {
    return this.crear(s, null, this.auth.sesion()?.nombre || 'Administrador');
  }

  cambiarEstado(id: string, s: SolicitudEstadoNovedad): Observable<NovedadVehiculo> {
    return responderLocal(() => {
      if (s.estado === 'RESUELTA' && !s.respuesta.trim()) throw new ErrorCrud('Cuenta qué se hizo para resolver la novedad.', 'VALIDACION');
      const todas = this.leer();
      const actual = this.buscar(todas, id);
      const cambiada: NovedadVehiculo = {
        ...actual,
        estado: s.estado,
        respuesta: s.respuesta.trim() || actual.respuesta,
        atiende: this.auth.sesion()?.nombre || 'Administrador',
        fechaAtencion: new Date().toISOString(),
      };
      this.escribir(todas.map((n) => (n.id === id ? cambiada : n)));
      return cambiada;
    }, this.latencia);
  }

  misVehiculos(): Observable<OpcionCatalogo[]> {
    return defer(() => from(this.opcionesMias()));
  }

  mias(): Observable<NovedadVehiculo[]> {
    return defer(() =>
      from(
        (async () => {
          const ids = new Set((await this.opcionesMias()).map((v) => v.id));
          const empleado = this.auth.sesion()?.empleadoId;
          return this.leer()
            .filter((n) => ids.has(n.vehiculoId) || (empleado && n.empleadoId === empleado))
            .sort((a, b) => (a.estado === 'RESUELTA' ? 1 : 0) - (b.estado === 'RESUELTA' ? 1 : 0) || b.fechaCreacion.localeCompare(a.fechaCreacion))
            .map((n) => this.paraLista(n));
        })(),
      ),
    );
  }

  obtenerMia(id: string): Observable<NovedadVehiculo> {
    return this.obtener(id);
  }

  reportar(s: SolicitudNovedad): Observable<NovedadVehiculo> {
    return defer(() =>
      from(
        (async () => {
          const empleadoId = this.auth.sesion()?.empleadoId;
          if (!empleadoId) throw new ErrorCrud('Inicia sesión como conductor o monitora para reportar novedades.', 'VALIDACION');
          if (!(await this.opcionesMias()).some((v) => v.id === s.vehiculoId)) {
            throw new ErrorCrud('Solo puedes reportar novedades de los vehículos de tus rutas asignadas. Consulta con el administrador.', 'VALIDACION');
          }
          const empleado = await firstValueFrom(this.injector.get(EmpleadosRepositorio).obtener(empleadoId));
          return firstValueFrom(this.crear(s, empleadoId, nombreCompleto(empleado)));
        })(),
      ),
    );
  }

  // ---------- internos ----------

  private crear(s: SolicitudNovedad, empleadoId: string | null, reporta: string): Observable<NovedadVehiculo> {
    return defer(() =>
      from(
        (async () => {
          this.validar(s);
          const v = await firstValueFrom(this.injector.get(VehiculosRepositorio).obtener(s.vehiculoId));
          const novedad: NovedadVehiculo & { empleadoId: string | null } = {
            id: crypto.randomUUID(),
            vehiculoId: v.id,
            vehiculo: `${v.placa} · Interno ${v.numeroInterno}`,
            tipo: s.tipo,
            gravedad: s.gravedad,
            descripcion: s.descripcion.trim(),
            kilometraje: s.kilometraje,
            estado: 'PENDIENTE',
            reporta,
            reportadaPorMi: false,
            delPersonal: !!empleadoId,
            respuesta: '',
            atiende: '',
            fechaAtencion: null,
            archivo: s.archivo,
            fechaCreacion: new Date().toISOString(),
            empleadoId,
          };
          this.escribir([novedad, ...this.leer()]);
          return this.conDueno(novedad);
        })(),
      ),
    );
  }

  private validar(s: SolicitudNovedad): void {
    if (!s.vehiculoId) throw new ErrorCrud('Elige el vehículo.', 'VALIDACION');
    if (!TIPOS_NOVEDAD.some((t) => t.id === s.tipo)) throw new ErrorCrud('Elige el tipo de novedad.', 'VALIDACION');
    if (!GRAVEDADES_NOVEDAD.some((g) => g.id === s.gravedad)) throw new ErrorCrud('Indica qué tan grave es.', 'VALIDACION');
    if (s.descripcion.trim().length < 10) throw new ErrorCrud('Describe la novedad con al menos 10 caracteres.', 'VALIDACION');
    if (s.archivo && s.archivo.tamano > DOS_MB) throw new ErrorCrud('El archivo supera 2 MB.', 'VALIDACION');
  }

  /** Vehículos de las asignaciones activas del empleado que no han terminado. */
  private async opcionesMias(): Promise<OpcionCatalogo[]> {
    const empleado = this.auth.sesion()?.empleadoId;
    if (!empleado) return [];
    const hoy = fechaIso();
    const asignaciones = await firstValueFrom(
      this.injector.get(AsignacionesRepositorio).listar({ ...FILTROS_ASIGNACION_VACIOS, empleadoId: empleado, estado: 'ACTIVO' }, SIN_PAGINAR),
    );
    const ids = new Set(asignaciones.items.filter((a) => !a.fechaFin || a.fechaFin >= hoy).map((a) => a.vehiculoId));
    const vehiculos = await firstValueFrom(this.injector.get(VehiculosRepositorio).listar(FILTROS_VEHICULO_VACIOS, SIN_PAGINAR));
    return vehiculos.items
      .filter((v) => ids.has(v.id))
      .map((v) => ({ id: v.id, nombre: `${v.placa} · Interno ${v.numeroInterno} · ${v.marca}` }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  private conDueno(n: NovedadVehiculo & { empleadoId?: string | null }): NovedadVehiculo {
    const { empleadoId, ...resto } = n;
    const yo = this.auth.sesion()?.empleadoId;
    return structuredClone({ ...resto, reportadaPorMi: !!yo && empleadoId === yo, delPersonal: !!empleadoId });
  }

  private paraLista(n: NovedadVehiculo): NovedadVehiculo {
    const c = this.conDueno(n);
    return { ...c, archivo: c.archivo ? { ...c.archivo, url: '' } : null };
  }

  private buscar(todas: NovedadVehiculo[], id: string): NovedadVehiculo {
    const n = todas.find((x) => x.id === id);
    if (!n) throw new ErrorCrud('La novedad no existe.', 'NO_ENCONTRADO');
    return this.conDueno(n);
  }

  /** Incluye `empleadoId` (interno: quién la reportó). */
  private leer(): (NovedadVehiculo & { empleadoId?: string | null })[] {
    try {
      return JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as NovedadVehiculo[];
    } catch {
      return [];
    }
  }

  private escribir(lista: NovedadVehiculo[]): void {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch {
      throw new ErrorCrud('No hay espacio en el almacenamiento temporal del navegador.', 'SIN_ESPACIO');
    }
  }
}
