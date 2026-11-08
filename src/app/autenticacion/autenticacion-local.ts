import { Injectable, inject } from '@angular/core';
import { Observable, defer, forkJoin, map, of, throwError } from 'rxjs';
import { AuthService, Credenciales, Sesion, USUARIO_DEMO } from 'src/app/core/auth';
import { FILTROS_ACUDIENTE_VACIOS } from 'src/app/personas/acudientes/acudiente';
import { AcudientesRepositorio } from 'src/app/personas/acudientes/acudientes-repositorio';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { FILTROS_EMPLEADO_VACIOS } from 'src/app/personas/empleados/empleado';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { FuenteLocal, SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { AutenticacionRepositorio, SolicitudRegistro } from './autenticacion-repositorio';
import { ADMIN_LOCAL, contrasenaDe, guardarCredencial, normalizarUsuario } from './credenciales-local';

export const MENSAJE_CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos.';

/**
 * Login TEMPORAL mientras no existe el API. El usuario es único en todo el sistema y define el rol:
 * - empleado (Personas › Empleados) → CONDUCTOR o MONITORA según su tipo;
 * - acudiente (Personas › Acudientes) → ACUDIENTE;
 * - `ADMIN_LOCAL` → ADMINISTRADOR con el perfil de ejemplo `USUARIO_DEMO`.
 * Inactivos no entran. El mensaje de error no revela si falló el usuario o la contraseña.
 */
@Injectable()
export class AutenticacionLocal extends AutenticacionRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly empleados = inject(EmpleadosRepositorio);
  private readonly acudientes = inject(AcudientesRepositorio);
  private readonly auth = inject(AuthService);

  iniciarSesion({ usuario, contrasena }: Credenciales): Observable<Sesion> {
    const limpio = normalizarUsuario(usuario);
    if (!limpio || !contrasena) {
      return throwError(() => new ErrorCrud('Ingresa tu usuario y tu contraseña.', 'VALIDACION'));
    }
    const base = { usuario: limpio, imagen: '', inicio: new Date().toISOString(), empleadoId: null, acudienteId: null };
    const invalidas = () => new ErrorCrud(MENSAJE_CREDENCIALES_INVALIDAS, 'VALIDACION');
    const inactivo = () => new ErrorCrud('Tu usuario está inactivo. Comunícate con el administrador.', 'VALIDACION');

    return forkJoin([
      this.empleados.listar(FILTROS_EMPLEADO_VACIOS, SIN_PAGINAR),
      this.acudientes.listar(FILTROS_ACUDIENTE_VACIOS, SIN_PAGINAR),
    ]).pipe(
      map(([empleados, acudientes]): Sesion => {
        if (limpio === ADMIN_LOCAL.usuario) {
          if (contrasena !== ADMIN_LOCAL.contrasena) throw invalidas();
          return { ...base, rol: 'ADMINISTRADOR', nombre: USUARIO_DEMO.nombre, correo: USUARIO_DEMO.correo, imagen: USUARIO_DEMO.imagen };
        }
        const mismo = (u: string | undefined) => normalizarUsuario(u ?? '') === limpio;
        const empleado = empleados.items.find((e) => mismo(e.usuario));
        if (empleado) {
          if (contrasenaDe(limpio, 'EMPLEADO') !== contrasena) throw invalidas();
          if (empleado.estado !== 'ACTIVO') throw inactivo();
          return { ...base, rol: empleado.tipoEmpleado, nombre: nombreCompleto(empleado), correo: empleado.correo, empleadoId: empleado.id };
        }
        const acudiente = acudientes.items.find((a) => mismo(a.usuario));
        if (acudiente) {
          if (contrasenaDe(limpio, 'ACUDIENTE') !== contrasena) throw invalidas();
          if (acudiente.estado !== 'ACTIVO') throw inactivo();
          return { ...base, rol: 'ACUDIENTE', nombre: nombreCompleto(acudiente), correo: acudiente.correo, acudienteId: acudiente.id };
        }
        throw invalidas();
      }),
    );
  }

  /** Cambia la contraseña local del empleado o acudiente de la sesión (`rutarola.credenciales`). */
  registrarEmpresa(_solicitud: SolicitudRegistro): Observable<Sesion> {
    return throwError(() => new ErrorCrud('El registro de empresas necesita el servidor. En modo local entra con un usuario de ejemplo.', 'VALIDACION'));
  }

  cambiarContrasena(actual: string, nueva: string): Observable<void> {
    return defer(() => {
      const sesion = this.auth.sesion();
      if (!sesion) return throwError(() => new ErrorCrud('Tu sesión expiró. Inicia sesión de nuevo.', 'VALIDACION'));
      if (normalizarUsuario(sesion.usuario) === ADMIN_LOCAL.usuario) {
        return throwError(() => new ErrorCrud('El administrador de demostración del modo local no cambia su contraseña.', 'VALIDACION'));
      }
      const titular = sesion.rol === 'ACUDIENTE' ? 'ACUDIENTE' : 'EMPLEADO';
      if (contrasenaDe(sesion.usuario, titular) !== actual) {
        return throwError(() => new ErrorCrud('La contraseña actual no es correcta.', 'VALIDACION'));
      }
      if (nueva.length < 6) return throwError(() => new ErrorCrud('La nueva contraseña debe tener al menos 6 caracteres.', 'VALIDACION'));
      if (nueva === actual) return throwError(() => new ErrorCrud('La nueva contraseña debe ser distinta de la actual.', 'VALIDACION'));
      guardarCredencial(sesion.usuario, nueva, titular);
      return of(undefined);
    });
  }
}
