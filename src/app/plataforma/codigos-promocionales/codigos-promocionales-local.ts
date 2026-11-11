import { Injectable } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { DatosRegistro, ErrorCrud } from 'src/app/shared/crud/crud';
import { RepositorioLocal, responderLocal } from 'src/app/shared/crud/repositorio-local';
import { normalizar } from 'src/app/shared/formularios/formularios';
import {
  CodigoPromocional,
  FILTROS_CODIGO_VACIOS,
  FiltrosCodigoPromocional,
  UsoCodigo,
  generarCodigo,
  normalizarCodigo,
  vigenciaDe,
} from './codigo-promocional';
import { CodigosPromocionalesRepositorio } from './codigos-promocionales-repositorio';

export const CLAVE_CODIGOS_LOCAL = 'rutarola.codigos-promocionales';

/** TEMPORAL (modo local y pruebas): los códigos viven en el navegador; sin pagos en línea no hay usos. */
@Injectable()
export class CodigosPromocionalesLocal
  extends RepositorioLocal<CodigoPromocional, FiltrosCodigoPromocional>
  implements CodigosPromocionalesRepositorio
{
  protected readonly clave = CLAVE_CODIGOS_LOCAL;
  protected readonly filtrosVacios = FILTROS_CODIGO_VACIOS;

  protected coincide(c: CodigoPromocional, f: FiltrosCodigoPromocional): boolean {
    const texto = normalizar(f.texto);
    return (
      (!texto || normalizar(`${c.codigo} ${c.descripcion}`).includes(texto)) &&
      (!f.estado || c.estado === f.estado) &&
      (!f.vigencia || vigenciaDe(c.fechaInicio, c.fechaFin) === f.vigencia)
    );
  }

  protected etiquetaOpcion(c: CodigoPromocional): string {
    return c.codigo;
  }

  protected override ordenar(a: CodigoPromocional, b: CodigoPromocional): number {
    return (b.fechaCreacion ?? '').localeCompare(a.fechaCreacion ?? '');
  }

  protected override preparar(datos: DatosRegistro<CodigoPromocional>, idActual: string | null, registros: CodigoPromocional[]): DatosRegistro<CodigoPromocional> {
    const { prefijo, ...resto } = datos;
    // Vacío: al editar se conserva; al crear lo genera el sistema (sin repetir).
    let codigo = normalizarCodigo(datos.codigo) || (registros.find((r) => r.id === idActual)?.codigo ?? '');
    while (!codigo || (!datos.codigo && registros.some((r) => r.codigo === codigo))) codigo = generarCodigo(prefijo);
    return {
      ...resto,
      codigo,
      descripcion: datos.descripcion.trim(),
      empresaIds: datos.alcance === 'EMPRESAS' ? datos.empresaIds : [],
      usos: datos.usos ?? 0,
    };
  }

  protected override validar(datos: DatosRegistro<CodigoPromocional>, idActual: string | null, registros: CodigoPromocional[]): void {
    const codigo = normalizarCodigo(datos.codigo);
    if (!codigo) return; // Lo genera el sistema.
    if (registros.some((r) => r.id !== idActual && r.codigo === codigo)) {
      throw new ErrorCrud(`Ya existe el código ${codigo}.`, 'DUPLICADO');
    }
    if (datos.fechaFin < datos.fechaInicio) {
      throw new ErrorCrud('La fecha final debe ser igual o posterior a la inicial.', 'VALIDACION');
    }
  }

  override motivoNoEliminar(id: string): Observable<string | null> {
    return this.responder(() => {
      const usos = this.leer().find((c) => c.id === id)?.usos ?? 0;
      return usos > 0 ? `El código ya se usó (${usos}). Déjalo Inactivo para que no se pueda usar más.` : null;
    });
  }

  usos(): Observable<UsoCodigo[]> {
    return defer(() => responderLocal(() => [], this.latenciaMs));
  }

  protected datosIniciales(): CodigoPromocional[] {
    return [
      {
        id: 'cod-1',
        codigo: 'BIENVENIDA20',
        descripcion: 'Bienvenida: 20 % de descuento en el primer mes',
        tipoDescuento: 'PORCENTAJE',
        valor: 20,
        fechaInicio: '2026-01-01',
        fechaFin: '2027-12-31',
        alcance: 'TODAS',
        planes: [],
        periodo: '',
        usosMaximos: null,
        usosPorEmpresa: 1,
        estado: 'ACTIVO',
        empresaIds: [],
        usos: 0,
        fechaCreacion: '2026-01-05T08:00:00.000Z',
        fechaActualizacion: '2026-01-05T08:00:00.000Z',
      },
    ];
  }
}
