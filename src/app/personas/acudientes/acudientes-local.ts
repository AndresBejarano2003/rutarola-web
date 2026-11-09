import { Injectable, Injector, inject } from '@angular/core';
import { Observable, forkJoin, map, tap } from 'rxjs';
import { CONTRASENA_DEMO, borrarCredencial, guardarCredencial, prepararAcceso, usuarioDemo, validarAcceso, validarUsuarioLibre } from 'src/app/autenticacion/credenciales-local';
import { FILTROS_EMPLEADO_VACIOS } from '../empleados/empleado';
import { EmpleadosRepositorio } from '../empleados/empleados-repositorio';
import { FILTROS_FACTURA_VACIOS } from 'src/app/finanzas/facturas/factura';
import { FacturasRepositorio } from 'src/app/finanzas/facturas/facturas-repositorio';
import { DatosRegistro } from 'src/app/shared/crud/crud';
import { RepositorioLocal, SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { coincideTexto, compararPorApellido, nombreCompleto, validarDocumentoUnico } from '../compartido/persona';
import { FILTROS_ESTUDIANTE_VACIOS } from '../estudiantes/estudiante';
import { EstudiantesRepositorio } from '../estudiantes/estudiantes-repositorio';
import { Acudiente, FILTROS_ACUDIENTE_VACIOS, FiltrosAcudiente } from './acudiente';
import { AcudientesRepositorio } from './acudientes-repositorio';

/** Almacenamiento TEMPORAL en `localStorage` mientras se construye el API. */
@Injectable()
export class AcudientesLocal
  extends RepositorioLocal<Acudiente, FiltrosAcudiente>
  implements AcudientesRepositorio
{
  protected readonly clave = 'rutarola.acudientes';
  protected readonly filtrosVacios = FILTROS_ACUDIENTE_VACIOS;
  private readonly injector = inject(Injector);

  protected coincide(a: Acudiente, f: FiltrosAcudiente): boolean {
    return coincideTexto(a, f.texto) && (!f.estado || a.estado === f.estado);
  }

  protected etiquetaOpcion(a: Acudiente): string {
    return nombreCompleto(a);
  }

  protected override ordenar(a: Acudiente, b: Acudiente): number {
    return compararPorApellido(a, b);
  }

  protected override validar(datos: DatosRegistro<Acudiente>, idActual: string | null, registros: Acudiente[]): void {
    validarDocumentoUnico(datos, idActual, registros, 'un acudiente');
    validarAcceso(datos, idActual, registros, 'ACUDIENTE');
  }

  /** El usuario tampoco puede estar en uso por un empleado. */
  protected override validarRelaciones(datos: DatosRegistro<Acudiente>): Observable<unknown> {
    return this.injector
      .get(EmpleadosRepositorio)
      .listar(FILTROS_EMPLEADO_VACIOS, SIN_PAGINAR)
      .pipe(map(({ items }) => validarUsuarioLibre(datos.usuario, items)));
  }

  /** La contraseña se guarda aparte (`credenciales-local.ts`); el registro nunca la lleva. */
  protected override preparar(datos: DatosRegistro<Acudiente>, idActual: string | null, registros: Acudiente[]): DatosRegistro<Acudiente> {
    return prepararAcceso(datos, idActual, registros, 'ACUDIENTE');
  }

  /** Al eliminar se libera su usuario. */
  override eliminar(id: string): Observable<void> {
    const usuario = this.leer().find((a) => a.id === id)?.usuario;
    return super.eliminar(id).pipe(tap(() => usuario && borrarCredencial(usuario)));
  }

  /** Regla de negocio: no se elimina un acudiente con estudiantes a cargo o facturas. */
  override motivoNoEliminar(id: string): Observable<string | null> {
    return forkJoin([
      this.injector.get(EstudiantesRepositorio).listar({ ...FILTROS_ESTUDIANTE_VACIOS, acudienteId: id }, { pagina: 1, tamano: 1 }),
      this.injector.get(FacturasRepositorio).listar({ ...FILTROS_FACTURA_VACIOS, acudienteId: id }, { pagina: 1, tamano: 1 }),
    ]).pipe(
      map(([estudiantes, facturas]) => {
        if (estudiantes.total) {
          return `No se puede eliminar: tiene ${estudiantes.total} estudiante(s) a cargo. Reasígnalos a otro acudiente o cámbialo a Inactivo.`;
        }
        if (facturas.total) {
          return `No se puede eliminar: tiene ${facturas.total} factura(s) registradas. Cámbialo a Inactivo para conservar el historial.`;
        }
        return null;
      }),
    );
  }

  protected datosIniciales(): Acudiente[] {
    const acudiente = (
      id: string,
      tipoDocumento: string,
      numeroDocumento: string,
      [primerNombre, segundoNombre, primerApellido, segundoApellido]: [string, string, string, string],
      telefono: string,
      correo: string,
      estado: Acudiente['estado'] = 'ACTIVO',
    ): Acudiente => ({
      id,
      tipoDocumento,
      numeroDocumento,
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      foto: '',
      telefono,
      telefonoAlterno: '',
      correo,
      direccion: 'Calle 10 # 5-23, Neiva',
      // Usuario de ejemplo: inicial del nombre + primer apellido (`mperez`), contraseña `CONTRASENA_DEMO`.
      usuario: usuarioDemo(primerNombre, primerApellido),
      contrasena: '',
      estado,
      fechaCreacion: '2026-01-10T08:00:00.000Z',
      fechaActualizacion: '2026-01-10T08:00:00.000Z',
    });

    // Los ids coinciden con los `acudienteId` de los estudiantes de ejemplo.
    const acudientes = [
      acudiente('acu-1', 'CC', '36181234', ['María', '', 'Pérez', 'López'], '3001234567', 'maria.perez@correo.com'),
      acudiente('acu-2', 'CC', '7712345', ['Carlos', 'Andrés', 'Rodríguez', 'Mejía'], '3109876543', 'carlos.rodriguez@correo.com'),
      acudiente('acu-3', 'CC', '55123456', ['Luz', 'Marina', 'Gómez', 'Vargas'], '3157654321', ''),
      acudiente('acu-4', 'CC', '12345678', ['Jorge', '', 'Martínez', 'Ruiz'], '3204567890', 'jorge.martinez@correo.com'),
      acudiente('acu-5', 'CC', '1075234567', ['Andrea', '', 'Castillo', 'Ortiz'], '3012345678', 'andrea.castillo@correo.com'),
      acudiente('acu-6', 'CE', '987654', ['Fernando', '', 'Ríos', 'Salazar'], '3118765432', ''),
      acudiente('acu-7', 'CC', '1075345678', ['Paola', 'Andrea', 'Silva', 'Torres'], '3165432109', 'paola.silva@correo.com'),
      acudiente('acu-8', 'CC', '4567890', ['Hernán', '', 'Quintero', 'Díaz'], '3176543210', '', 'INACTIVO'),
    ];
    for (const a of acudientes) guardarCredencial(a.usuario, CONTRASENA_DEMO, 'ACUDIENTE');
    return acudientes;
  }
}
