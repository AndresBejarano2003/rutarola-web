import { Injectable, Injector, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { FILTROS_FACTURA_VACIOS } from 'src/app/finanzas/facturas/factura';
import { FacturasRepositorio } from 'src/app/finanzas/facturas/facturas-repositorio';
import { RutasRepositorio } from 'src/app/operacion/rutas/rutas-repositorio';
import { DatosRegistro } from 'src/app/shared/crud/crud';
import { RepositorioLocal } from 'src/app/shared/crud/repositorio-local';
import { coincideTexto, compararPorApellido, nombreCompleto, validarDocumentoUnico } from '../compartido/persona';
import { Estudiante, FILTROS_ESTUDIANTE_VACIOS, FiltrosEstudiante } from './estudiante';
import { EstudiantesRepositorio } from './estudiantes-repositorio';

/** Almacenamiento TEMPORAL en `localStorage` mientras se construye el API. */
@Injectable()
export class EstudiantesLocal
  extends RepositorioLocal<Estudiante, FiltrosEstudiante>
  implements EstudiantesRepositorio
{
  protected readonly clave = 'rutarola.estudiantes';
  protected readonly filtrosVacios = FILTROS_ESTUDIANTE_VACIOS;
  private readonly injector = inject(Injector);

  /** No se elimina un estudiante que va en una ruta o tiene facturas. */
  override motivoNoEliminar(id: string): Observable<string | null> {
    return forkJoin([
      this.injector.get(RutasRepositorio).opciones({ estudianteId: id }),
      this.injector.get(FacturasRepositorio).listar({ ...FILTROS_FACTURA_VACIOS, estudianteId: id }, { pagina: 1, tamano: 1 }),
    ]).pipe(
      map(([rutas, facturas]) => {
        if (rutas.length) {
          return `No se puede eliminar: está en la ruta ${rutas.map((r) => r.nombre).join(', ')}. Quítalo de la ruta o cámbialo a Inactivo.`;
        }
        if (facturas.total) {
          return `No se puede eliminar: tiene ${facturas.total} factura(s) registradas. Cámbialo a Inactivo para conservar el historial.`;
        }
        return null;
      }),
    );
  }

  protected coincide(e: Estudiante, f: FiltrosEstudiante): boolean {
    return (
      coincideTexto(e, f.texto) &&
      (!f.acudienteId || e.acudienteId === f.acudienteId) &&
      (!f.colegioId || e.colegioId === f.colegioId) &&
      (!f.grado || e.grado === f.grado) &&
      (!f.estado || e.estado === f.estado)
    );
  }

  protected etiquetaOpcion(e: Estudiante): string {
    return nombreCompleto(e);
  }

  protected override ordenar(a: Estudiante, b: Estudiante): number {
    return compararPorApellido(a, b);
  }

  protected override validar(datos: DatosRegistro<Estudiante>, idActual: string | null, registros: Estudiante[]): void {
    validarDocumentoUnico(datos, idActual, registros, 'un estudiante');
  }

  protected datosIniciales(): Estudiante[] {
    const base = (
      id: string,
      tipoDocumento: string,
      numeroDocumento: string,
      [primerNombre, segundoNombre, primerApellido, segundoApellido]: [string, string, string, string],
      fechaNacimiento: string,
      acudienteId: string,
      colegioId: string,
      grado: string,
      jornada: string,
      estado: Estudiante['estado'] = 'ACTIVO',
    ): Estudiante => ({
      id,
      tipoDocumento,
      numeroDocumento,
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      foto: '',
      fechaNacimiento,
      direccion: 'Calle 10 # 5-23, Neiva',
      acudienteId,
      colegioId,
      grado,
      jornada,
      estado,
      observaciones: '',
      fechaCreacion: '2026-01-15T08:00:00.000Z',
      fechaActualizacion: '2026-01-15T08:00:00.000Z',
    });

    return [
      base('est-1', 'TI', '1020304050', ['Juan', 'Sebastián', 'Pérez', 'López'], '2013-04-12', 'acu-1', 'col-5', '7°', 'Mañana'),
      base('est-2', 'TI', '1020304051', ['Valentina', '', 'Pérez', 'López'], '2015-09-03', 'acu-1', 'col-5', '5°', 'Mañana'),
      base('est-3', 'RC', '1122334455', ['Samuel', 'David', 'Rodríguez', 'Mejía'], '2019-02-21', 'acu-2', 'col-1', 'Transición', 'Mañana'),
      base('est-4', 'TI', '1098765432', ['Isabella', '', 'Gómez', 'Vargas'], '2012-11-30', 'acu-3', 'col-2', '8°', 'Tarde'),
      base('est-5', 'TI', '1098765433', ['Mateo', 'Andrés', 'Gómez', 'Vargas'], '2014-06-18', 'acu-3', 'col-2', '6°', 'Tarde'),
      base('est-6', 'CC', '1075123456', ['Daniela', '', 'Martínez', 'Ruiz'], '2008-01-09', 'acu-4', 'col-3', '11°', 'Única'),
      base('est-7', 'TI', '1075987654', ['Tomás', '', 'Martínez', 'Ruiz'], '2011-07-25', 'acu-4', 'col-3', '9°', 'Única'),
      base('est-8', 'RC', '1133557799', ['Emiliano', '', 'Castillo', 'Ortiz'], '2020-03-14', 'acu-5', 'col-4', 'Jardín', 'Mañana'),
      base('est-9', 'TI', '1144668800', ['Sara', 'Lucía', 'Castillo', 'Ortiz'], '2016-12-01', 'acu-5', 'col-4', '4°', 'Mañana'),
      base('est-10', 'TI', '1066778899', ['Martín', '', 'Ríos', 'Salazar'], '2013-10-10', 'acu-6', 'col-1', '7°', 'Tarde', 'INACTIVO'),
      base('est-11', 'RC', '1155443322', ['Antonella', '', 'Ríos', 'Salazar'], '2018-08-08', 'acu-6', 'col-1', '1°', 'Tarde'),
      base('est-12', 'TI', '1088990011', ['Jerónimo', '', 'Rodríguez', 'Mejía'], '2015-05-05', 'acu-2', 'col-1', '5°', 'Mañana'),
    ];
  }
}
