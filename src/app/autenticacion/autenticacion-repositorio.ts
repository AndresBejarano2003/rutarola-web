import { Observable } from 'rxjs';
import { Credenciales, Sesion } from 'src/app/core/auth';
import { ComienzoRegistro } from 'src/app/sistema/membresias/suscripcion';

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
  /** Cuentas de acudiente unidas a la de la sesión (en otras empresas de transporte), la actual incluida. */
  abstract cuentasUnidas(): Observable<CuentaUnida[]>;
  /** Une la cuenta de OTRA empresa escribiendo su usuario y contraseña. Devuelve el grupo actualizado. */
  abstract unirCuenta(usuario: string, contrasena: string): Observable<CuentaUnida[]>;
  /** Saca una cuenta del grupo (la propia u otra). */
  abstract separarCuenta(idUsuario: string): Observable<CuentaUnida[]>;
  /** Entra a otra cuenta unida sin contraseña: sesión de esa empresa (la actual se cierra en el servidor). */
  abstract entrarACuenta(idUsuario: string): Observable<Sesion>;
}

/** `GET /auth/cuentas`: una cuenta de acudiente del grupo. */
export interface CuentaUnida {
  idUsuario: string;
  usuario: string;
  nombre: string;
  idEmpresa: string;
  empresa: string;
  /** Es la de la sesión. */
  actual: boolean;
  /** Se puede entrar (cuenta y empresa activas y la empresa permite unir cuentas). */
  disponible: boolean;
  /** Por qué no está disponible. */
  motivo: string;
  /** Nombres de sus estudiantes activos en esa empresa. */
  estudiantes: string[];
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
  /**
   * `GRATIS`: plan Gratis sin vencimiento. `PRUEBA`: días de Profesional (al vencer sin pago, Gratis). `PAGAR`: empieza
   * en Gratis con la pasarela pendiente para pagar el plan elegido.
   */
  comienzo: ComienzoRegistro;
}
