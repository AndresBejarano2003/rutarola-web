import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@environments/environment';
import { Empresa } from 'src/app/inicio/configuracion/configuracion';
import { desdeApi } from 'src/app/inicio/configuracion/configuracion-http';
import { Pagina, Paginacion } from 'src/app/shared/crud/crud';
import { AdministradorEmpresa, FiltrosEmpresa, ResumenMembresias, SolicitudAdministrador, SolicitudEmpresa } from './empresa';
import { EmpresasRepositorio } from './empresas-repositorio';

/**
 * `empresas.gestionar` (SUPER_ADMIN):
 * - `GET /empresas?texto=&estado=&membresia=&plan=&pagina=&tamano=` → `Pagina<Empresa>` (por nombre) con la `membresia`
 *   de cada una (plan, situación PRUEBA|PRUEBA_POR_VENCER|ACTIVA|POR_VENCER|VENCIDA|GRATIS, fechas, días, último pago);
 * - `GET /empresas/resumen-membresias` → `ResumenMembresias`;
 * - `POST /empresas` → 201 con la configuración por defecto y, si viene `administrador`, su primer
 *   usuario ADMINISTRADOR (409 NIT repetido o usuario/correo ya en uso);
 * - `PUT /empresas/{id}` (sin `administrador`). No hay DELETE: se inactiva.
 * - Administradores: `GET /empresas/{id}/administradores` → `AdministradorEmpresa[]` (sin contraseña);
 *   `POST` (201; contraseña obligatoria, 422 sin ella), `PUT /empresas/{id}/administradores/{usuarioId}`
 *   (contraseña vacía = se conserva) y `PUT …/{usuarioId}/contrasena {nueva}` → 204. Cambiar la contraseña o
 *   inactivar cierra sus sesiones. 409 si el usuario (único en todo el sistema) o el correo ya están en uso;
 *   404 si el usuario no es administrador de ESA empresa.
 */
@Injectable()
export class EmpresasHttp extends EmpresasRepositorio {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/empresas`;

  listar(filtros: FiltrosEmpresa, paginacion: Paginacion): Observable<Pagina<Empresa>> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries({ ...filtros, ...paginacion })) {
      if (valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<Pagina<Parameters<typeof desdeApi>[0]>>(this.url, { params }).pipe(map((p) => ({ ...p, items: p.items.map(desdeApi) })));
  }

  resumenMembresias(): Observable<ResumenMembresias> {
    return this.http.get<ResumenMembresias>(`${this.url}/resumen-membresias`);
  }

  crear(solicitud: SolicitudEmpresa): Observable<Empresa> {
    return this.http.post<Parameters<typeof desdeApi>[0]>(this.url, solicitud).pipe(map(desdeApi));
  }

  administradores(empresaId: string): Observable<AdministradorEmpresa[]> {
    return this.http.get<AdministradorEmpresa[]>(this.urlAdministradores(empresaId));
  }

  crearAdministrador(empresaId: string, solicitud: SolicitudAdministrador): Observable<AdministradorEmpresa> {
    return this.http.post<AdministradorEmpresa>(this.urlAdministradores(empresaId), solicitud);
  }

  actualizarAdministrador(empresaId: string, id: string, solicitud: SolicitudAdministrador): Observable<AdministradorEmpresa> {
    return this.http.put<AdministradorEmpresa>(`${this.urlAdministradores(empresaId)}/${encodeURIComponent(id)}`, solicitud);
  }

  cambiarContrasenaAdministrador(empresaId: string, id: string, nueva: string): Observable<void> {
    return this.http.put<void>(`${this.urlAdministradores(empresaId)}/${encodeURIComponent(id)}/contrasena`, { nueva });
  }

  private urlAdministradores(empresaId: string): string {
    return `${this.url}/${encodeURIComponent(empresaId)}/administradores`;
  }

  actualizar(id: string, solicitud: SolicitudEmpresa): Observable<Empresa> {
    const { administrador: _, ...datos } = solicitud;
    return this.http.put<Parameters<typeof desdeApi>[0]>(`${this.url}/${encodeURIComponent(id)}`, datos).pipe(map(desdeApi));
  }
}
