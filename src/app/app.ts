import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TemaApp } from './core/tema';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Aplica el tema claro u oscuro de la empresa desde el arranque.
  private readonly tema = inject(TemaApp);
}
