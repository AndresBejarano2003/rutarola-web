import { Observable } from 'rxjs';
import type { TemaApariencia } from 'src/app/core/tema';
import type { DatosFormatoDocumentos, FormatoDocumentos } from 'src/app/shared/documentos-pdf/documentos-pdf';
import { DatosEmpresa, Empresa, Parametro } from './configuracion';

/**
 * Datos de la empresa del administrador y sus parámetros. Implementaciones: `ConfiguracionLocal`
 * (temporal, en el navegador) → `ConfiguracionHttp`.
 */
export abstract class ConfiguracionRepositorio {
  abstract empresa(): Observable<Empresa>;
  abstract guardarEmpresa(datos: DatosEmpresa): Observable<Empresa>;
  abstract parametros(): Observable<Parametro[]>;
  abstract guardarParametro(clave: string, valor: string): Observable<Parametro>;
  /** Encabezado y pie de los PDF (lo lee cualquier usuario de la empresa que genera documentos). */
  abstract formatoDocumentos(): Observable<FormatoDocumentos>;
  abstract guardarFormatoDocumentos(datos: DatosFormatoDocumentos): Observable<FormatoDocumentos>;
  /** Tema claro u oscuro para todos los usuarios de la empresa. */
  abstract tema(): Observable<TemaApariencia>;
  abstract guardarTema(tema: TemaApariencia): Observable<TemaApariencia>;
}
