import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CeldaPersona } from '../celda-persona/celda-persona';
import { inicialesDe } from './foto';

const FOTO = 'data:image/jpeg;base64,AAAA';

@Component({
  imports: [CeldaPersona],
  template: `<app-celda-persona nombre="Ana Gómez" iniciales="AG" [foto]="foto()" />`,
})
class Anfitrion {
  readonly foto = signal('');
}

describe('Fotos de perfil', () => {
  it('las iniciales salen del primer nombre y el primer apellido', () => {
    expect(inicialesDe('Ana María Gómez Ruiz')).toBe('AG');
    expect(inicialesDe('Andrés Bejarano')).toBe('AB');
    expect(inicialesDe('Yolanda')).toBe('Y');
    expect(inicialesDe('  ')).toBe('?');
  });

  it('la celda de la tabla muestra la foto si existe y si no las iniciales', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('AG');

    fixture.componentInstance.foto.set(FOTO);
    await fixture.whenStable();
    expect(el.querySelector('img')?.getAttribute('src')).toBe(FOTO);
    expect(el.textContent).not.toContain('AG');
  });
});
