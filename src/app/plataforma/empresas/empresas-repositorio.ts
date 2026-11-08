import { Observable } from 'rxjs';
import { Empresa } from 'src/app/inicio/configuracion/configuracion';
import { RepositorioLectura } from 'src/app/shared/crud/repositorio-crud';
import { AdministradorEmpresa, FiltrosEmpresa, SolicitudAdministrador, SolicitudEmpresa } from './empresa';

/**
 * Empresas de transporte de la plataforma (solo SUPER_ADMIN). No se eliminan: se dejan INACTIVAS
 * (sus usuarios ya no pueden entrar). Implementaciones: `EmpresasLocal` → `EmpresasHttp`.
 */
export abstract class EmpresasRepositorio extends RepositorioLectura<Empresa, FiltrosEmpresa> {
  abstract crear(solicitud: SolicitudEmpresa): Observable<Empresa>;
  abstract actualizar(id: string, solicitud: SolicitudEmpresa): Observable<Empresa>;

  // Administradores de cada empresa (la plataforma los ve y les restablece la contraseña).
  abstract administradores(empresaId: string): Observable<AdministradorEmpresa[]>;
  abstract crearAdministrador(empresaId: string, solicitud: SolicitudAdministrador): Observable<AdministradorEmpresa>;
  /** Contraseña vacía = se conserva. Cambiarla o inactivar cierra sus sesiones. */
  abstract actualizarAdministrador(empresaId: string, id: string, solicitud: SolicitudAdministrador): Observable<AdministradorEmpresa>;
  /** Restablece la contraseña y cierra todas las sesiones del administrador. */
  abstract cambiarContrasenaAdministrador(empresaId: string, id: string, nueva: string): Observable<void>;
}
