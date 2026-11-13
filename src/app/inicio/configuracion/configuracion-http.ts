import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { TemaApariencia } from 'src/app/core/tema';
import type { DatosFormatoDocumentos, FormatoDocumentos } from 'src/app/shared/documentos-pdf/documentos-pdf';
import { environment } from '@environments/environment';
import { EstadoRegistro } from 'src/app/shared/crud/crud';
import { DatosEmpresa, Empresa, Parametro } from './configuracion';
import { ConfiguracionRepositorio } from './configuracion-repositorio';

/** `EmpresaDto` del API: los opcionales pueden llegar en `null`. */
type EmpresaApi = Omit<Empresa, 'direccion' | 'ciudad' | 'telefono' | 'email' | 'logoUrl'> &
  Partial<Record<'direccion' | 'ciudad' | 'telefono' | 'email' | 'logoUrl', string | null>>;

export function desdeApi(e: EmpresaApi): Empresa {
  return {
    ...e,
    direccion: e.direccion ?? '',
    ciudad: e.ciudad ?? '',
    telefono: e.telefono ?? '',
    email: e.email ?? '',
    logoUrl: e.logoUrl ?? '',
    estado: e.estado as EstadoRegistro,
  };
}

/**
 * | Operación       | Petición |
 * |-----------------|----------|
 * | empresa         | `GET /empresas/actual` |
 * | guardarEmpresa  | `PUT /empresas/actual {nombre, direccion, ciudad, telefono, email, logoUrl}` (`configuracion.gestionar`; no cambia NIT ni estado) |
 * | parametros      | `GET /configuracion` → `Parametro[]` (`configuracion.gestionar`) |
 * | guardarParametro| `PUT /configuracion/{clave} {valor}` (422 fuera de `minimo`–`maximo`) |
 * | formatoDocumentos | `GET /configuracion/documentos` → `FormatoDocumentos` (cualquier usuario de la empresa) |
 * | guardarFormatoDocumentos | `PUT /configuracion/documentos` (`configuracion.gestionar`; 400 logo > 300 KB o no imagen, color no #RRGGBB, sin nombre) |
 * | tema / guardarTema | `GET/PUT /empresas/actual/tema {tema: OSCURO|CLARO}` → `{tema}`; la sesión de cada usuario trae `empresa.tema` |
 *
 * Los parámetros los usa el servidor en reportes, portal, tablero, notificaciones y conductores.
 */
@Injectable()
export class ConfiguracionHttp extends ConfiguracionRepositorio {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;

  empresa(): Observable<Empresa> {
    return this.http.get<EmpresaApi>(`${this.url}/empresas/actual`).pipe(map(desdeApi));
  }

  guardarEmpresa(datos: DatosEmpresa): Observable<Empresa> {
    return this.http.put<EmpresaApi>(`${this.url}/empresas/actual`, datos).pipe(map(desdeApi));
  }

  parametros(): Observable<Parametro[]> {
    return this.http.get<Parametro[]>(`${this.url}/configuracion`);
  }

  formatoDocumentos(): Observable<FormatoDocumentos> {
    return this.http.get<FormatoDocumentos>(`${this.url}/configuracion/documentos`);
  }

  guardarFormatoDocumentos(datos: DatosFormatoDocumentos): Observable<FormatoDocumentos> {
    return this.http.put<FormatoDocumentos>(`${this.url}/configuracion/documentos`, datos);
  }

  tema(): Observable<TemaApariencia> {
    return this.http.get<{ tema: TemaApariencia }>(`${this.url}/empresas/actual/tema`).pipe(map((r) => r.tema));
  }

  guardarTema(tema: TemaApariencia): Observable<TemaApariencia> {
    return this.http.put<{ tema: TemaApariencia }>(`${this.url}/empresas/actual/tema`, { tema }).pipe(map((r) => r.tema));
  }

  guardarParametro(clave: string, valor: string): Observable<Parametro> {
    return this.http.put<Parametro>(`${this.url}/configuracion/${encodeURIComponent(clave)}`, { valor });
  }
}
