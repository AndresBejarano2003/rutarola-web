import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import EstudiantesPage from './estudiantes-page';

describe('EstudiantesPage', () => {
  let fixture: ComponentFixture<EstudiantesPage>;
  let el: HTMLElement;
  let ui: ReturnType<typeof pantalla>;

  beforeEach(async () => {
    localStorage.clear();
    simularDialogos();
    TestBed.configureTestingModule({
      imports: [EstudiantesPage],
      providers: [provideRouter([]), ...repositoriosDePrueba()],
    });
    fixture = TestBed.createComponent(EstudiantesPage);
    el = fixture.nativeElement;
    ui = pantalla(el);
    await estabilizar(fixture);
  });

  it('muestra la primera página del listado, el total y el acudiente de cada estudiante', () => {
    expect(ui.filas('app-estudiantes-tabla').length).toBe(10);
    expect(el.textContent).toContain('12 registros');
    expect(el.textContent).toContain('Modo local');
    expect(el.textContent).toContain('María Pérez López');
  });

  it('filtra el listado escribiendo en el selector de colegio', async () => {
    ui.elegir('colegioId', 'gaitana', el.querySelector('app-estudiantes-filtros') as HTMLElement);
    await new Promise((r) => setTimeout(r, 350)); // debounce de los filtros
    await estabilizar(fixture);
    expect(el.textContent).toContain('2 registros');
  });

  it('filtra por acudiente con los acudientes reales del módulo', async () => {
    ui.elegir('acudienteId', 'castillo', el.querySelector('app-estudiantes-filtros') as HTMLElement);
    await new Promise((r) => setTimeout(r, 350));
    await estabilizar(fixture);
    expect(el.textContent).toContain('2 registros');
  });

  it('muestra los botones en el pie fijo y el formulario en el cuerpo con scroll', async () => {
    ui.boton('Nuevo estudiante').click();
    await estabilizar(fixture);
    const modal = el.querySelector('app-modal') as HTMLElement;
    const pie = modal.querySelector('footer') as HTMLElement;
    const cuerpo = modal.querySelector('.overflow-y-auto') as HTMLElement;
    expect(pie.querySelector('app-acciones-formulario')).not.toBeNull();
    expect(cuerpo.querySelector('app-estudiante-formulario')).not.toBeNull();
    expect(cuerpo.querySelector('button[type="submit"]')).toBeNull();
    expect(pie.querySelector('button[type="submit"]')?.getAttribute('form')).toBe('form-estudiante');
  });

  it('valida campos obligatorios y luego registra un estudiante', async () => {
    ui.boton('Nuevo estudiante').click();
    await estabilizar(fixture);
    ui.boton('Registrar estudiante').click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('Este campo es obligatorio.');

    ui.elegir('tipoDocumento', 'tarjeta');
    ui.escribir('numeroDocumento', '5555555555');
    ui.escribir('primerNombre', 'Aaron');
    ui.escribir('primerApellido', 'Abadía');
    ui.escribir('fechaNacimiento', '2014-02-02');
    ui.escribir('direccion', 'Calle 5');
    ui.elegir('acudienteId', 'paola');
    ui.elegir('colegioId', 'cayetano');
    ui.elegir('grado', '6°');
    ui.elegir('jornada', 'manana');
    ui.boton('Registrar estudiante').click();
    await estabilizar(fixture, 3);

    expect(el.querySelector('app-estudiante-formulario')).toBeNull();
    expect(el.textContent).toContain('13 registros');
    expect(el.textContent).toContain('Aaron Abadía');
    expect(el.textContent).toContain('Paola Andrea Silva Torres');
  });

  it('elimina un estudiante tras confirmar', async () => {
    (el.querySelector('button[aria-label="Eliminar"]') as HTMLButtonElement).click();
    await estabilizar(fixture);
    (el.querySelector('app-dialogo-confirmacion button.btn-error') as HTMLButtonElement).click();
    await estabilizar(fixture, 3);
    expect(el.textContent).toContain('11 registros');
  });

  it('abre la consulta en solo lectura y permite pasar a edición', async () => {
    (el.querySelector('button[aria-label="Consultar"]') as HTMLButtonElement).click();
    await estabilizar(fixture);
    const campo = () => el.querySelector('[formcontrolname="primerNombre"]') as HTMLInputElement;
    expect(campo().disabled).toBe(true);
    ui.boton('Editar').click();
    await estabilizar(fixture);
    expect(campo().disabled).toBe(false);
    expect(el.textContent).toContain('Guardar cambios');
  });

  it('registra un acudiente nuevo sin salir del formulario del estudiante y lo deja elegido', async () => {
    ui.boton('Nuevo estudiante').click();
    await estabilizar(fixture);
    ui.escribir('primerNombre', 'Aaron');
    (el.querySelector('button[aria-label="Nuevo acudiente"]') as HTMLButtonElement).click();
    await estabilizar(fixture);

    const alta = el.querySelector('app-alta-acudiente') as HTMLElement;
    const form = alta.querySelector('form') as HTMLElement;
    const escribir = (control: string, valor: string) => {
      const campo = form.querySelector(`input[formcontrolname="${control}"]`) as HTMLInputElement;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    };
    ui.elegir('tipoDocumento', 'cedula de ciu', form);
    escribir('numeroDocumento', '1075111222');
    escribir('primerNombre', 'Rosa');
    escribir('primerApellido', 'Quintero');
    escribir('telefono', '3005551234');
    escribir('usuario', 'rquintero');
    escribir('contrasena', 'clave123');
    escribir('confirmarContrasena', 'clave123');
    (alta.querySelector('footer button[type="submit"]') as HTMLButtonElement).click();
    await estabilizar(fixture, 3);

    // Lo escrito en el estudiante sigue ahí y el acudiente nuevo quedó elegido.
    const estudiante = el.querySelector('app-estudiante-formulario') as HTMLElement;
    expect((estudiante.querySelector('input[formcontrolname="primerNombre"]') as HTMLInputElement).value).toBe('Aaron');
    expect((estudiante.querySelector('app-selector-busqueda[formcontrolname="acudienteId"] input') as HTMLInputElement).value).toContain(
      'Rosa Quintero',
    );
  });
});
