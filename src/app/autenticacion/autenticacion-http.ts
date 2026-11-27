import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { Credenciales, ROLES_USUARIO, RolUsuario, Sesion, TokensSesion } from 'src/app/core/auth';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { AutenticacionRepositorio, CuentaUnida, DatosPerfil, PerfilUsuario, SolicitudRegistro } from './autenticacion-repositorio';

/** Respuesta de `POST /auth/login`. */
export interface RespuestaLogin {
  /** `rol`: uno de `ROLES_USUARIO` (`SUPER_ADMIN` entra a la plataforma, `/plataforma`). */
  sesion: Omit<Sesion, 'tokens' | 'rol'> & { rol: string };
  tokens: TokensSesion;
}

/**
 * `POST {apiUrl}/auth/login` `{usuario, contrasena}` → `{ sesion, tokens }` (ver `api/README.md`).
 * `usuario` puede ser el usuario de ingreso o el correo. El SERVIDOR decide el rol:
 * - empleado activo (Personas › Empleados) → CONDUCTOR/MONITORA y `empleadoId`;
 * - acudiente activo (Personas › Acudientes) → ACUDIENTE y `acudienteId`;
 * - administrador de la empresa → ADMINISTRADOR; super administrador de la plataforma → SUPER_ADMIN.
 * 401 `Usuario o contraseña incorrectos.`; 403 usuario, empresa o persona inactivos (con `{mensaje}`).
 * Los tokens viajan dentro de la sesión; `interceptorAutenticacion` los usa y los renueva.
 *
 * `PUT {apiUrl}/auth/contrasena {actual, nueva}` → 204 (422 `La contraseña actual no es correcta.`,
 * 400 nueva < 6) y revoca las demás sesiones del usuario.
 *
 * `POST {apiUrl}/auth/registro {empresa, administrador, aceptaTerminos}` (público, limitado por IP) → 201
 * `{ sesion, tokens }`: crea la empresa según `comienzo`: `GRATIS` (plan Gratis sin vencimiento), `PRUEBA` (días del plan Profesional que fija la plataforma) o `PAGAR` (en Gratis con el pago pendiente). 400 validación; 409 NIT,
 * usuario o correo ya registrados.
 *
 * `GET {apiUrl}/auth/perfil` → `PerfilUsuario`; `PUT {apiUrl}/auth/perfil {nombre, correo, telefono, foto}` →
 * la sesión actualizada (400 foto no válida; 409 correo en uso; 422 falta el teléfono o el nombre).
 *
 * Cuentas unidas (solo acudientes; 403 otros roles): `GET /auth/cuentas` → `CuentaUnida[]`; `POST /auth/cuentas
 * {usuario, contrasena}` → el grupo (422 credenciales incorrectas, misma empresa, inactiva o alguna empresa no lo
 * permite — `portal.acudientes_unen_cuentas`; 409 ya unida; limitado por IP); `DELETE /auth/cuentas/{idUsuario}` →
 * el grupo; `POST /auth/cuentas/{idUsuario}/sesion` → `{sesion, tokens}` de esa empresa (cierra la actual).
 */
@Injectable()
export class AutenticacionHttp extends AutenticacionRepositorio {
  private readonly http = inject(HttpClient);

  iniciarSesion({ usuario, contrasena }: Credenciales): Observable<Sesion> {
    return this.http
      .post<RespuestaLogin>(`${environment.apiUrl}/auth/login`, { usuario: usuario.trim(), contrasena })
      .pipe(map(aSesion));
  }

  registrarEmpresa(solicitud: SolicitudRegistro): Observable<Sesion> {
    return this.http.post<RespuestaLogin>(`${environment.apiUrl}/auth/registro`, solicitud).pipe(map(aSesion));
  }

  perfil(): Observable<PerfilUsuario> {
    return this.http.get<PerfilUsuario>(`${environment.apiUrl}/auth/perfil`);
  }

  actualizarPerfil(datos: DatosPerfil): Observable<Pick<Sesion, 'nombre' | 'correo' | 'imagen'>> {
    return this.http
      .put<RespuestaLogin['sesion']>(`${environment.apiUrl}/auth/perfil`, datos)
      .pipe(map(({ nombre, correo, imagen }) => ({ nombre, correo, imagen })));
  }

  cambiarContrasena(actual: string, nueva: string): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/auth/contrasena`, { actual, nueva });
  }

  cuentasUnidas(): Observable<CuentaUnida[]> {
    return this.http.get<CuentaUnida[]>(`${environment.apiUrl}/auth/cuentas`);
  }

  unirCuenta(usuario: string, contrasena: string): Observable<CuentaUnida[]> {
    return this.http.post<CuentaUnida[]>(`${environment.apiUrl}/auth/cuentas`, { usuario: usuario.trim(), contrasena });
  }

  separarCuenta(idUsuario: string): Observable<CuentaUnida[]> {
    return this.http.delete<CuentaUnida[]>(`${environment.apiUrl}/auth/cuentas/${encodeURIComponent(idUsuario)}`);
  }

  entrarACuenta(idUsuario: string): Observable<Sesion> {
    return this.http.post<RespuestaLogin>(`${environment.apiUrl}/auth/cuentas/${encodeURIComponent(idUsuario)}/sesion`, null).pipe(map(aSesion));
  }
}

function aSesion({ sesion, tokens }: RespuestaLogin): Sesion {
  if (!ROLES_USUARIO.some((r) => r.id === sesion.rol)) {
    throw new ErrorCrud('Este usuario no tiene acceso a esta aplicación.', 'VALIDACION');
  }
  return { ...sesion, rol: sesion.rol as RolUsuario, tokens };
}
