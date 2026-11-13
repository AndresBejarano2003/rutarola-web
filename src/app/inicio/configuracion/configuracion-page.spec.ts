import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import AjustesPlataformaPage from 'src/app/plataforma/ajustes/ajustes-plataforma-page';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import ConfiguracionPage from './configuracion-page';
import { ConfiguracionRepositorio } from './configuracion-repositorio';

describe('Configuración: documentos PDF, apariencia y ajustes de la plataforma', () => {
  beforeEach(() => {
    localStorage.clear();
    simularDialogos();
    document.documentElement.dataset['theme'] = 'rutarola';
  });

  async function abrir() {
    TestBed.configureTestingModule({ imports: [ConfiguracionPage], providers: [provideRouter([]), ...repositoriosDePrueba()] });
    const fixture = TestBed.createComponent(ConfiguracionPage);
    await estabilizar(fixture, 4);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('guarda el formato de los PDF con los datos de la empresa como punto de partida', async () => {
    const { fixture, el } = await abrir();
    pantalla(el).boton('Documentos PDF').click();
    await estabilizar(fixture, 4);
    const nombre = el.querySelector('input[formcontrolname="nombreComercial"]') as HTMLInputElement;
    expect(nombre.value).toBe('RutaRola Demo');
    expect(el.querySelector('iframe[title="Vista previa del documento"]')).not.toBeNull();

    const eslogan = el.querySelector('input[formcontrolname="eslogan"]') as HTMLInputElement;
    eslogan.value = 'Seguros y puntuales';
    eslogan.dispatchEvent(new Event('input'));
    pantalla(el).boton('Guardar formato').click();
    await estabilizar(fixture, 4);
    const guardado = await firstValueFrom(TestBed.inject(ConfiguracionRepositorio).formatoDocumentos());
    expect(guardado).toMatchObject({ eslogan: 'Seguros y puntuales', personalizado: true });
  });

  it('cambia el tema de la empresa a claro y lo recuerda', async () => {
    const { fixture, el } = await abrir();
    pantalla(el).boton('Apariencia').click();
    await estabilizar(fixture, 4);
    const claro = [...el.querySelectorAll<HTMLInputElement>('input[name="tema"]')][1];
    claro.dispatchEvent(new Event('change'));
    await estabilizar(fixture, 4);
    expect(document.documentElement.dataset['theme']).toBe('rutarola-claro');
    expect(localStorage.getItem('rutarola.tema')).toBe('CLARO');
  });

  it('la plataforma ajusta los días de la prueba gratuita', async () => {
    TestBed.configureTestingModule({ imports: [AjustesPlataformaPage], providers: [provideRouter([]), ...repositoriosDePrueba()] });
    const fixture = TestBed.createComponent(AjustesPlataformaPage);
    await estabilizar(fixture, 4);
    const el = fixture.nativeElement as HTMLElement;
    const campo = el.querySelector('input[type="number"]') as HTMLInputElement;
    expect(campo.value).toBe('15');
    campo.value = '20';
    campo.dispatchEvent(new Event('input'));
    await estabilizar(fixture, 2);
    pantalla(el).boton('Guardar').click();
    await estabilizar(fixture, 4);
    expect(JSON.parse(localStorage.getItem('rutarola.parametros-plataforma') ?? '{}')).toMatchObject({ 'suscripcion.dias_prueba': '20' });
  });
});
