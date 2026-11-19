import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import PrivacidadPage, { RESPONSABLE_DATOS } from './privacidad-page';

describe('Política de privacidad', () => {
  it('muestra al responsable, el contacto y lo que Google Play exige (ubicación, menores, eliminar la cuenta)', async () => {
    TestBed.configureTestingModule({ imports: [PrivacidadPage], providers: [provideRouter([])] });
    const f = TestBed.createComponent(PrivacidadPage);
    await f.whenStable();
    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain(RESPONSABLE_DATOS.nombre);
    expect(texto).toContain(RESPONSABLE_DATOS.correo);
    expect(texto).toContain('solo mientras un recorrido está en curso');
    expect(texto).toContain('30 días');
    expect(texto).toContain('niños, niñas y adolescentes');
    expect(texto).toContain('Eliminar tu cuenta');
    for (const id of ['quien', 'ubicacion', 'derechos', 'eliminar']) {
      expect((f.nativeElement as HTMLElement).querySelector(`#${id}`)).not.toBeNull();
    }
  });
});
