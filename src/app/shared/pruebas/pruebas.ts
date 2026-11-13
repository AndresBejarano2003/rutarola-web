/**
 * Utilidades SOLO para pruebas: todos los repositorios locales (los mismos de
 * `core/repositorios.ts`) sin latencia y helpers para interactuar con la pantalla.
 */
import { Provider } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { proveerRepositorios } from 'src/app/core/repositorios';
import { LATENCIA_LOCAL } from 'src/app/shared/crud/repositorio-local';

/** Repositorios locales sin latencia. Llamar `localStorage.clear()` antes de cada prueba. */
export function repositoriosDePrueba(): Provider[] {
  simularVideo();
  // Las pruebas siempre usan los repositorios locales, sin importar el entorno.
  return [...proveerRepositorios({ usarApi: false }), { provide: LATENCIA_LOCAL, useValue: 0 }];
}

/**
 * jsdom no reproduce video (avisa "Not implemented" en cada `play()`): la animación del login
 * (`<app-presentacion>`) se queda en su primer cuadro y pasa al login por tiempo.
 */
export function simularVideo(): void {
  if (typeof HTMLMediaElement === 'undefined') return;
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => undefined;
}

/** jsdom no implementa `<dialog>.showModal/close`. */
export function simularDialogos(): void {
  // ApexCharts usa ResizeObserver, que jsdom tampoco implementa.
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

export async function estabilizar(fixture: ComponentFixture<unknown>, veces = 2): Promise<void> {
  for (let i = 0; i < veces; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

/** Helpers sobre el DOM de una pantalla CRUD. */
export function pantalla(el: HTMLElement) {
  const formulario = () => el.querySelector('app-modal form') as HTMLElement;
  return {
    boton: (texto: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement,
    filas: (tabla: string) => el.querySelectorAll(`${tabla} tbody tr`),
    escribir: (control: string, valor: string) => {
      const campo = formulario().querySelector(`input[formcontrolname="${control}"]`) as HTMLInputElement;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    },
    /** Escribe en un `<app-selector-busqueda>` y elige la primera coincidencia con Enter. */
    elegir: (control: string, texto: string, contenedor: HTMLElement = formulario()) => {
      const campo = contenedor.querySelector(`app-selector-busqueda[formcontrolname="${control}"] input`) as HTMLInputElement;
      campo.dispatchEvent(new Event('focus'));
      campo.value = texto;
      campo.dispatchEvent(new Event('input'));
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    },
  };
}
