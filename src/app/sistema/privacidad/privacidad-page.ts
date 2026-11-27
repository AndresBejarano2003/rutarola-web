import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Datos del responsable que aparecen en la política (persona natural; cambiar aquí si se crea la empresa). */
export const RESPONSABLE_DATOS = {
  nombre: 'Andrés Felipe Bejarano Acero',
  correo: 'andresf.bejarano@gmail.com',
  ciudad: 'Bogotá D.C., Colombia',
  vigencia: '26 de noviembre de 2026',
} as const;

/**
 * Páginas legales públicas en el sitio rutarola.com (`sitio-web/privacidad.html`, `terminos.html`, `eliminar-cuenta.html`):
 * son las que van en Google Play. El registro las abre en otra pestaña sin perder el formulario. La política de esta página
 * y la del sitio deben decir lo mismo.
 */
export const URL_PRIVACIDAD = 'https://rutarola.com/privacidad';
export const URL_TERMINOS = 'https://rutarola.com/terminos';

/**
 * Política de tratamiento de datos personales (`/privacidad`, pública, sin sesión), enlazada desde el login, el registro
 * y la ficha de Google Play. Debe coincidir con lo que el sistema hace: si cambia qué datos se guardan, la ubicación, la
 * retención o los proveedores, actualizar esta página.
 */
@Component({
  selector: 'app-privacidad-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './privacidad-page.html',
})
export default class PrivacidadPage {
  protected readonly r = RESPONSABLE_DATOS;

  /** Navegación dentro de la página sin `href="#…"` (con hash routing cambiaría la ruta). */
  protected ir(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
