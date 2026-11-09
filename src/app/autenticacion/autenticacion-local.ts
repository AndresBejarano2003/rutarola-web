import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom, forkJoin, from, map, of, throwError } from 'rxjs';
import { AuthService, Credenciales, Sesion, USUARIO_DEMO } from 'src/app/core/auth';
import { FILTROS_ACUDIENTE_VACIOS } from 'src/app/personas/acudientes/acudiente';
import { AcudientesRepositorio } from 'src/app/personas/acudientes/acudientes-repositorio';
import { nombreCompleto } from 'src/app/personas/compartido/persona';
import { FILTROS_EMPLEADO_VACIOS } from 'src/app/personas/empleados/empleado';
import { EmpleadosRepositorio } from 'src/app/personas/empleados/empleados-repositorio';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { FuenteLocal, SIN_PAGINAR } from 'src/app/shared/crud/repositorio-local';
import { AutenticacionRepositorio, DatosPerfil, PerfilUsuario, SolicitudRegistro } from './autenticacion-repositorio';
import { ADMIN_LOCAL, contrasenaDe, guardarCredencial, normalizarUsuario } from './credenciales-local';

export const MENSAJE_CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos.';

/** Perfil editable del administrador de demostración (`ADMIN_LOCAL`), solo en este navegador. */
const CLAVE_PERFIL_ADMIN = 'rutarola.perfil-admin';
type PerfilAdmin = Pick<PerfilUsuario, 'nombre' | 'correo' | 'telefono' | 'foto'>;

function perfilAdmin(): PerfilAdmin {
  const base: PerfilAdmin = { nombre: USUARIO_DEMO.nombre, correo: USUARIO_DEMO.correo, telefono: '', foto: USUARIO_DEMO.imagen };
  try {
    return { ...base, ...(JSON.parse(localStorage.getItem(CLAVE_PERFIL_ADMIN) ?? 'null') as Partial<PerfilAdmin> | null) };
  } catch {
    return base;
  }
}

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
          const perfil = perfilAdmin();
          return { ...base, rol: 'ADMINISTRADOR', nombre: perfil.nombre, correo: perfil.correo, imagen: perfil.foto };
        }
        const mismo = (u: string | undefined) => normalizarUsuario(u ?? '') === limpio;
        const empleado = empleados.items.find((e) => mismo(e.usuario));
        if (empleado) {
          if (contrasenaDe(limpio, 'EMPLEADO') !== contrasena) throw invalidas();
          if (empleado.estado !== 'ACTIVO') throw inactivo();
          return { ...base, rol: empleado.tipoEmpleado, nombre: nombreCompleto(empleado), correo: empleado.correo, empleadoId: empleado.id, imagen: empleado.foto ?? '' };
        }
        const acudiente = acudientes.items.find((a) => mismo(a.usuario));
        if (acudiente) {
          if (contrasenaDe(limpio, 'ACUDIENTE') !== contrasena) throw invalidas();
          if (acudiente.estado !== 'ACTIVO') throw inactivo();
          return { ...base, rol: 'ACUDIENTE', nombre: nombreCompleto(acudiente), correo: acudiente.correo, acudienteId: acudiente.id, imagen: acudiente.foto ?? '' };
        }
        throw invalidas();
      }),
    );
  }

  /** Cambia la contraseña local del empleado o acudiente de la sesión (`rutarola.credenciales`). */
  registrarEmpresa(_solicitud: SolicitudRegistro): Observable<Sesion> {
    return throwError(() => new ErrorCrud('El registro de empresas necesita el servidor. En modo local entra con un usuario de ejemplo.', 'VALIDACION'));
  }

  /** Administrador de demostración: perfil en este navegador; empleado o acudiente: su registro de Personas. */
  perfil(): Observable<PerfilUsuario> {
    return from(this.leerPerfil());
  }

  actualizarPerfil(datos: DatosPerfil): Observable<Pick<Sesion, 'nombre' | 'correo' | 'imagen'>> {
    return from(this.guardarPerfil(datos));
  }

  private async leerPerfil(): Promise<PerfilUsuario> {
    const sesion = this.sesionActual();
    if (sesion.empleadoId) {
      const e = await firstValueFrom(this.empleados.obtener(sesion.empleadoId));
      return { usuario: sesion.usuario, rol: sesion.rol, nombre: nombreCompleto(e), editaNombre: false, correo: e.correo, telefono: e.telefono, foto: e.foto ?? '' };
    }
    if (sesion.acudienteId) {
      const a = await firstValueFrom(this.acudientes.obtener(sesion.acudienteId));
      return { usuario: sesion.usuario, rol: sesion.rol, nombre: nombreCompleto(a), editaNombre: false, correo: a.correo, telefono: a.telefono, foto: a.foto ?? '' };
    }
    return { usuario: sesion.usuario, rol: sesion.rol, editaNombre: true, ...perfilAdmin() };
  }

  private async guardarPerfil(datos: DatosPerfil): Promise<Pick<Sesion, 'nombre' | 'correo' | 'imagen'>> {
    const sesion = this.sesionActual();
    const correo = datos.correo.trim().toLowerCase();
    const telefono = datos.telefono.trim();
    if ((sesion.empleadoId || sesion.acudienteId) && !telefono) throw new ErrorCrud('Ingresa tu teléfono de contacto.', 'VALIDACION');
    if (sesion.empleadoId) {
      const { id, fechaCreacion, fechaActualizacion, ...e } = await firstValueFrom(this.empleados.obtener(sesion.empleadoId));
      const guardado = await firstValueFrom(this.empleados.actualizar(id, { ...e, contrasena: '', correo, telefono, foto: datos.foto }));
      return { nombre: nombreCompleto(guardado), correo: guardado.correo, imagen: guardado.foto };
    }
    if (sesion.acudienteId) {
      const { id, fechaCreacion, fechaActualizacion, ...a } = await firstValueFrom(this.acudientes.obtener(sesion.acudienteId));
      const guardado = await firstValueFrom(this.acudientes.actualizar(id, { ...a, contrasena: '', correo, telefono, foto: datos.foto }));
      return { nombre: nombreCompleto(guardado), correo: guardado.correo, imagen: guardado.foto };
    }
    const nombre = datos.nombre.trim();
    if (!nombre) throw new ErrorCrud('Ingresa tu nombre.', 'VALIDACION');
    const perfil: PerfilAdmin = { nombre, correo, telefono, foto: datos.foto };
    try {
      localStorage.setItem(CLAVE_PERFIL_ADMIN, JSON.stringify(perfil));
    } catch {
      throw new ErrorCrud('No hay espacio en este navegador para guardar la foto.', 'SIN_ESPACIO');
    }
    return { nombre, correo, imagen: perfil.foto };
  }

  private sesionActual(): Sesion {
    const sesion = this.auth.sesion();
    if (!sesion) throw new ErrorCrud('Tu sesión expiró. Inicia sesión de nuevo.', 'VALIDACION');
    return sesion;
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
