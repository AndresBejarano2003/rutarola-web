import { inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificacionesService } from '../notificaciones/notificaciones';
import { CambiosDatos } from './cambios-datos';
import { DatosRegistro, Entidad, mensajeDeError } from './crud';
import { ListadoStore } from './listado-store';
import { RepositorioCrud } from './repositorio-crud';

export { TAMANOS_PAGINA } from './listado-store';

export interface TextosCrud {
  creado: string;
  actualizado: string;
  eliminado: string;
}

/**
 * Estado de una pantalla CRUD (listado, filtros, paginación, guardado)
 * basado en signals. Cada módulo crea su store extendiendo esta clase y
 * lo provee en el componente de la página (`providers: [XStore]`).
 */
export abstract class CrudStore<T extends Entidad, F extends object> extends ListadoStore<T, F> {
  protected abstract override readonly repositorio: RepositorioCrud<T, F>;
  protected abstract readonly textos: TextosCrud;

  private readonly notificaciones = inject(NotificacionesService);
  private readonly cambios = inject(CambiosDatos);
  private readonly _guardando = signal(false);

  /** No se recarga solo mientras se guarda o elimina. */
  protected override puedeRecargarSolo(): boolean {
    return !this._guardando();
  }
  readonly guardando = this._guardando.asReadonly();

  /** Obtiene el registro completo (para consultar/editar). `null` si falla. */
  async obtener(id: string): Promise<T | null> {
    try {
      return await firstValueFrom(this.repositorio.obtener(id));
    } catch (error) {
      this.notificaciones.error(mensajeDeError(error));
      return null;
    }
  }

  /** Crea (`id === null`) o actualiza. Devuelve `true` si se guardó. */
  async guardar(datos: DatosRegistro<T>, id: string | null): Promise<boolean> {
    return (await this.guardarRegistro(datos, id)) !== null;
  }

  /** Crea y devuelve el registro guardado (con su id), o `null` si falló. */
  crear(datos: DatosRegistro<T>): Promise<T | null> {
    return this.guardarRegistro(datos, null);
  }

  private async guardarRegistro(datos: DatosRegistro<T>, id: string | null): Promise<T | null> {
    this._guardando.set(true);
    try {
      const registro = await firstValueFrom(id ? this.repositorio.actualizar(id, datos) : this.repositorio.crear(datos));
      this.notificaciones.exito(id ? this.textos.actualizado : this.textos.creado);
      this.cambios.notificar();
      this.recargar();
      return registro;
    } catch (error) {
      this.notificaciones.error(mensajeDeError(error));
      return null;
    } finally {
      this._guardando.set(false);
    }
  }

  /** Motivo por el que el registro no se puede eliminar, o `null` (si la verificación falla, decide el servidor). */
  async motivoNoEliminar(id: string): Promise<string | null> {
    try {
      return await firstValueFrom(this.repositorio.motivoNoEliminar(id));
    } catch {
      return null;
    }
  }

  async eliminar(id: string): Promise<boolean> {
    this._guardando.set(true);
    try {
      await firstValueFrom(this.repositorio.eliminar(id));
      this.notificaciones.exito(this.textos.eliminado);
      this.cambios.notificar();
      // Si se borró el último registro de la página, retroceder una.
      const { pagina } = this.paginacion();
      if (this.items().length === 1 && pagina > 1) {
        this.paginacion.update((p) => ({ ...p, pagina: pagina - 1 }));
      }
      this.recargar();
      return true;
    } catch (error) {
      this.notificaciones.error(mensajeDeError(error));
      return false;
    } finally {
      this._guardando.set(false);
    }
  }
}
