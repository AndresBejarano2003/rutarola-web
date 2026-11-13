import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfiguracionRepositorio } from 'src/app/inicio/configuracion/configuracion-repositorio';
import { mensajeDeError } from '../crud/crud';
import { NotificacionesService } from '../notificaciones/notificaciones';
import { ContenidoDocumento, FormatoDocumentos, htmlDocumento, imprimirHtml } from './documentos-pdf';

/**
 * Genera los PDF de la empresa (factura, recibo, cotización) con su formato (logo, nombre, eslogan, contacto,
 * color, notas). El formato se lee una vez y se refresca cuando la configuración lo guarda (`establecer`).
 * Se provee junto a los repositorios (`core/repositorios.ts`).
 */
@Injectable()
export class GeneradorPdf {
  private readonly configuracion = inject(ConfiguracionRepositorio);
  private readonly avisos = inject(NotificacionesService);
  private formato: Promise<FormatoDocumentos> | null = null;

  establecer(formato: FormatoDocumentos): void {
    this.formato = Promise.resolve(formato);
  }

  /** Abre "Imprimir / Guardar como PDF" con el documento. */
  async descargar(contenido: ContenidoDocumento): Promise<void> {
    try {
      this.formato ??= firstValueFrom(this.configuracion.formatoDocumentos());
      imprimirHtml(htmlDocumento(await this.formato, contenido));
    } catch (e) {
      this.formato = null;
      this.avisos.error(mensajeDeError(e));
    }
  }
}
