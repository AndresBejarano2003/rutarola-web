import { Observable } from 'rxjs';
import { Credenciales, Sesion } from 'src/app/core/auth';

/**
 * Valida credenciales y devuelve la sesión con el TIPO DE USUARIO, que decide a qué
 * sistema entra (`rutaInicio(rol)`). Falla con `ErrorCrud` (`VALIDACION`) si no son válidas.
 * Implementaciones: `AutenticacionLocal` (temporal) → `AutenticacionHttp` (`POST /auth/login`).
 */
export abstract class AutenticacionRepositorio {
  abstract iniciarSesion(credenciales: Credenciales): Observable<Sesion>;
  /**
   * Cambia la contraseña del usuario de la SESIÓN (exige la actual; la nueva, mínimo 6). Con el API
   * cierra sus demás sesiones (otros teléfonos o navegadores); la actual sigue abierta.
   */
  abstract cambiarContrasena(actual: string, nueva: string): Observable<void>;
  /**
   * Registra una empresa de transporte con su administrador (prueba gratuita del plan Profesional) y
   * devuelve la sesión del administrador. Solo con el API.
   */
  abstract registrarEmpresa(solicitud: SolicitudRegistro): Observable<Sesion>;
  /** Datos de contacto y foto del usuario de la SESIÓN (Mi cuenta). */
  abstract perfil(): Observable<PerfilUsuario>;
  /**
   * Guarda los datos propios y devuelve lo que cambia en la sesión (nombre, correo, foto). El administrador
   * cambia también su nombre; conductores, monitoras y acudientes, su teléfono (obligatorio), correo y foto.
   */
  abstract actualizarPerfil(datos: DatosPerfil): Observable<Pick<Sesion, 'nombre' | 'correo' | 'imagen'>>;
}

/** `GET /auth/perfil`. `editaNombre`: solo administradores (el de las personas es el de su documento). */
export interface PerfilUsuario {
  usuario: string;
  rol: string;
  nombre: string;
  editaNombre: boolean;
  correo: string;
  telefono: string;
  /** Data URL de la foto; `''` = iniciales. */
  foto: string;
}

export type DatosPerfil = Pick<PerfilUsuario, 'nombre' | 'correo' | 'telefono' | 'foto'>;

export interface SolicitudRegistro {
  empresa: { nombre: string; nit: string; ciudad: string; telefono: string };
  administrador: { nombre: string; usuario: string; email: string; contrasena: string };
  aceptaTerminos: boolean;
}
