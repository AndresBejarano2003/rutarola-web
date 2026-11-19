import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Datos del responsable que aparecen en la política (persona natural; cambiar aquí si se crea la empresa). */
export const RESPONSABLE_DATOS = {
  nombre: 'Andrés Felipe Bejarano Acero',
  correo: 'andresf.bejarano@gmail.com',
  ciudad: 'Bogotá D.C., Colombia',
  vigencia: '18 de noviembre de 2026',
} as const;

/** URL pública de la política (la que va en Google Play); el registro la abre en otra pestaña sin perder el formulario. */
export const URL_PRIVACIDAD = 'https://app.rutarola.com/#/privacidad';

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
