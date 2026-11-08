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
}

export interface SolicitudRegistro {
  empresa: { nombre: string; nit: string; ciudad: string; telefono: string };
  administrador: { nombre: string; usuario: string; email: string; contrasena: string };
  aceptaTerminos: boolean;
}
