import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import { modulosDelMenu } from './contenido-ayuda';
import SoportePage from './soporte-page';

async function crear() {
  TestBed.configureTestingModule({
    imports: [SoportePage],
    providers: [provideRouter([]), ...repositoriosDePrueba()],
  });
  const fixture = TestBed.createComponent(SoportePage);
  await estabilizar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, ui: pantalla(el) };
}

describe('SoportePage', () => {
  beforeEach(() => {
    localStorage.clear();
    simularDialogos();
  });

  it('muestra tutoriales, manuales y preguntas frecuentes', async () => {
    const { el } = await crear();
    expect(el.textContent).toContain('Tutoriales destacados');
    expect(el.textContent).toContain('Manual general');
    expect(el.querySelectorAll('details').length).toBeGreaterThan(0);
    expect(el.textContent).toContain('No tienes solicitudes en curso');
  });

  it('la búsqueda filtra el contenido y avisa cuando no hay resultados', async () => {
    const { fixture, el } = await crear();
    const busqueda = el.querySelector('input[type="search"]') as HTMLInputElement;
    busqueda.value = 'recibo';
    busqueda.dispatchEvent(new Event('input'));
    await estabilizar(fixture);
    expect(el.textContent).toContain('¿Cómo registro un pago?');
    expect(el.textContent).not.toContain('¿Cómo asigno un vehículo');

    busqueda.value = 'zzzz';
    busqueda.dispatchEvent(new Event('input'));
    await estabilizar(fixture);
    expect(el.textContent).toContain('No encontramos ayuda');
  });

  it('abre el visor de un tutorial', async () => {
    const { fixture, el } = await crear();
    (el.querySelector('#soporte-tutoriales li button') as HTMLButtonElement).click();
    await estabilizar(fixture);
    expect(el.querySelector('app-modal iframe')?.getAttribute('src')).toContain('youtube-nocookie.com/embed/');
  });

  it('valida la solicitud y la registra con consecutivo', async () => {
    const { fixture, el, ui } = await crear();
    const form = el.querySelector('#form-solicitud-soporte') as HTMLFormElement;

    ui.boton('Enviar solicitud').click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('Elige el tipo de solicitud.');
    expect(el.textContent).toContain('Este campo es obligatorio.');

    (form.querySelector('input[type="radio"][formcontrolname="tipo"]') as HTMLInputElement).click();
    ui.elegir('modulo', modulosDelMenu()[1].nombre, form);
    const asunto = form.querySelector('input[formcontrolname="asunto"]') as HTMLInputElement;
    asunto.value = 'No carga el listado';
    asunto.dispatchEvent(new Event('input'));
    const descripcion = form.querySelector('textarea') as HTMLTextAreaElement;
    descripcion.value = 'Al abrir la pantalla de estudiantes la tabla queda vacía.';
    descripcion.dispatchEvent(new Event('input'));

    ui.boton('Enviar solicitud').click();
    await estabilizar(fixture, 4);
    expect(el.textContent).toContain('SOP-0001');
    expect(el.textContent).toContain('No carga el listado');
    expect(asunto.value).toBe('');

    // El detalle muestra el historial y deja responder o cancelar.
    ui.boton('No carga el listado').click();
    await estabilizar(fixture, 4);
    expect(el.textContent).toContain('Abrió la solicitud');
    expect(el.textContent).toContain('Responder al equipo de soporte');
    ui.boton('Cancelar solicitud').click();
    await estabilizar(fixture);
    ui.boton('Cancelar solicitud').click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('Este campo es obligatorio');
    (el.querySelector('#form-accion-ticket textarea') as HTMLTextAreaElement).value = 'Ya se solucionó solo';
    el.querySelector('#form-accion-ticket textarea')!.dispatchEvent(new Event('input'));
    ui.boton('Cancelar solicitud').click();
    await estabilizar(fixture, 4);
    expect(el.textContent).toContain('La solicitud se canceló');
  });
});
