import { Injectable, Injector, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { CONTRASENA_DEMO, borrarCredencial, guardarCredencial, prepararAcceso, usuarioDemo, validarAcceso, validarUsuarioLibre } from 'src/app/autenticacion/credenciales-local';
import { FILTROS_ACUDIENTE_VACIOS } from '../acudientes/acudiente';
import { AcudientesRepositorio } from '../acudientes/acudientes-repositorio';
import { DatosRegistro } from 'src/app/shared/crud/crud';
import { RepositorioLocal, SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { coincideTexto, compararPorApellido, nombreCompleto, validarDocumentoUnico } from '../compartido/persona';
import { FILTROS_ASIGNACION_VACIOS } from 'src/app/operacion/asignaciones/asignacion';
import { AsignacionesRepositorio } from 'src/app/operacion/asignaciones/asignaciones-repositorio';
import { Empleado, FILTROS_EMPLEADO_VACIOS, FiltrosEmpleado, TipoContrato, TipoEmpleado } from './empleado';
import { EmpleadosRepositorio } from './empleados-repositorio';

/** Almacenamiento TEMPORAL en `localStorage` mientras se construye el API. */
@Injectable()
export class EmpleadosLocal
  extends RepositorioLocal<Empleado, FiltrosEmpleado>
  implements EmpleadosRepositorio
{
  protected readonly clave = 'rutarola.empleados';
  protected readonly filtrosVacios = FILTROS_EMPLEADO_VACIOS;
  private readonly injector = inject(Injector);

  /** No se elimina un conductor o monitora con asignaciones de ruta. */
  override motivoNoEliminar(id: string): Observable<string | null> {
    return this.injector
      .get(AsignacionesRepositorio)
      .listar({ ...FILTROS_ASIGNACION_VACIOS, empleadoId: id }, { pagina: 1, tamano: 1 })
      .pipe(
        map(({ total }) =>
          total
            ? `No se puede eliminar: tiene ${total} asignación(es) de ruta. Si dejó de trabajar, cambia su estado a Inactivo.`
            : null,
        ),
      );
  }

  protected coincide(e: Empleado, f: FiltrosEmpleado): boolean {
    return (
      coincideTexto(e, f.texto) &&
      (!f.tipoEmpleado || e.tipoEmpleado === f.tipoEmpleado) &&
      (!f.estado || e.estado === f.estado)
    );
  }

  protected etiquetaOpcion(e: Empleado): string {
    return nombreCompleto(e);
  }

  protected override ordenar(a: Empleado, b: Empleado): number {
    return compararPorApellido(a, b);
  }

  protected override validar(datos: DatosRegistro<Empleado>, idActual: string | null, registros: Empleado[]): void {
    validarDocumentoUnico(datos, idActual, registros, 'un empleado');
    validarAcceso(datos, idActual, registros, 'EMPLEADO');
  }

  /** El usuario tampoco puede estar en uso por un acudiente. */
  protected override validarRelaciones(datos: DatosRegistro<Empleado>): Observable<unknown> {
    return this.injector
      .get(AcudientesRepositorio)
      .listar(FILTROS_ACUDIENTE_VACIOS, SIN_PAGINAR)
      .pipe(map(({ items }) => validarUsuarioLibre(datos.usuario, items)));
  }

  /** La contraseña se guarda aparte (`credenciales-local.ts`); el registro nunca la lleva. */
  protected override preparar(datos: DatosRegistro<Empleado>, idActual: string | null, registros: Empleado[]): DatosRegistro<Empleado> {
    return prepararAcceso(datos, idActual, registros, 'EMPLEADO');
  }

  /** Al eliminar se libera su usuario. */
  override eliminar(id: string): Observable<void> {
    const usuario = this.leer().find((e) => e.id === id)?.usuario;
    return super.eliminar(id).pipe(tap(() => usuario && borrarCredencial(usuario)));
  }

  protected datosIniciales(): Empleado[] {
    const fecha = (diasDesdeHoy: number) => {
      const d = new Date();
      d.setDate(d.getDate() + diasDesdeHoy);
      return d.toISOString().slice(0, 10);
    };
    // Usuario de ejemplo: inicial del nombre + primer apellido (`jcardenas`), contraseña `CONTRASENA_DEMO`.
    const empleado = (
      id: string,
      numeroDocumento: string,
      [primerNombre, segundoNombre, primerApellido, segundoApellido]: [string, string, string, string],
      tipoEmpleado: TipoEmpleado,
      sueldo: number,
      tipoContrato: TipoContrato,
      telefono: string,
      licencia: { numero: string; categoria: string; vencimiento: string } | null,
      estado: Empleado['estado'] = 'ACTIVO',
    ): Empleado => ({
      id,
      tipoDocumento: 'CC',
      numeroDocumento,
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      foto: '',
      tipoEmpleado,
      telefono,
      correo: '',
      direccion: 'Carrera 5 # 12-40, Neiva',
      fechaIngreso: '2025-02-01',
      sueldo,
      tipoContrato,
      contrato: null,
      numeroLicencia: licencia?.numero ?? '',
      categoriaLicencia: licencia?.categoria ?? '',
      vencimientoLicencia: licencia?.vencimiento ?? '',
      usuario: usuarioDemo(primerNombre, primerApellido),
      contrasena: '',
      estado,
      fechaCreacion: '2026-01-05T08:00:00.000Z',
      fechaActualizacion: '2026-01-05T08:00:00.000Z',
    });

    const empleados = [
      empleado('emp-1', '7698123', ['José', 'Luis', 'Cárdenas', 'Rojas'], 'CONDUCTOR', 2200000, 'TERMINO_INDEFINIDO', '3101112233',
        { numero: '7698123', categoria: 'C2', vencimiento: fecha(400) }),
      empleado('emp-2', '12134567', ['Wilson', '', 'Perdomo', 'Trujillo'], 'CONDUCTOR', 2200000, 'TERMINO_FIJO', '3112223344',
        { numero: '12134567', categoria: 'C1', vencimiento: fecha(20) }),
      empleado('emp-3', '83045678', ['Édgar', 'Alonso', 'Vargas', 'Cuéllar'], 'CONDUCTOR', 2100000, 'TERMINO_FIJO', '3123334455',
        { numero: '83045678', categoria: 'C2', vencimiento: fecha(-15) }),
      empleado('emp-4', '1075212345', ['Diego', '', 'Losada', 'Ramírez'], 'CONDUCTOR', 2000000, 'OBRA_LABOR', '3134445566',
        { numero: '1075212345', categoria: 'C1', vencimiento: fecha(900) }),
      empleado('emp-5', '93123456', ['Ricardo', '', 'Polanía', 'Medina'], 'CONDUCTOR', 2000000, 'TERMINO_INDEFINIDO', '3145556677',
        { numero: '93123456', categoria: 'C3', vencimiento: fecha(200) }, 'INACTIVO'),
      empleado('emp-6', '1075298765', ['Yuli', 'Andrea', 'Charry', 'Ortiz'], 'MONITORA', 1600000, 'TERMINO_FIJO', '3156667788', null),
      empleado('emp-7', '36301234', ['Sandra', 'Milena', 'Tovar', 'Ruiz'], 'MONITORA', 1600000, 'TERMINO_INDEFINIDO', '3167778899', null),
      empleado('emp-8', '1077865432', ['Karen', '', 'Méndez', 'Calderón'], 'MONITORA', 1500000, 'PRESTACION_SERVICIOS', '3178889900', null),
    ];
    for (const e of empleados) guardarCredencial(e.usuario, CONTRASENA_DEMO, 'EMPLEADO');
    return empleados;
  }
}
