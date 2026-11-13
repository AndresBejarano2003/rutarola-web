import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PlanEmpresa } from 'src/app/core/plan-empresa';
import { planDesdeConFuncion } from 'src/app/sistema/membresias/suscripcion';
import { MENU_OPERATIVO, MENU_SISTEMA, OpcionMenu } from './opciones-menu';

const CLAVE_MENUS_ABIERTOS = 'menusAbiertos';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-menu-lateral',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive],
  templateUrl: './menu-lateral.html',
})
export class MenuLateral {
  protected readonly menuOperativo = MENU_OPERATIVO;
  protected readonly menuSistema = MENU_SISTEMA;

  private readonly menusAbiertos = signal(new Set<string>(leerMenusAbiertos()));
  private readonly plan = inject(PlanEmpresa, { optional: true });

  /** "Esencial" si el plan de la empresa no incluye la función de la opción; null si está disponible. */
  protected bloqueo(opcion: OpcionMenu): string | null {
    return opcion.funcion && this.plan && !this.plan.tiene(opcion.funcion) ? planDesdeConFuncion(opcion.funcion).nombre : null;
  }

  protected estaAbierto(menu: string): boolean {
    return this.menusAbiertos().has(menu);
  }

  /** En móvil/tablet el menú es un panel superpuesto: se cierra al elegir una opción. */
  protected cerrarEnMovil(): void {
    const toggle = document.getElementById('drawer-toggle');
    if (toggle instanceof HTMLInputElement) {
      toggle.checked = false;
    }
  }

  protected alternarMenu(menu: string): void {
    this.menusAbiertos.update((abiertos) => {
      const siguiente = new Set(abiertos);
      if (siguiente.has(menu)) {
        siguiente.delete(menu);
      } else {
        siguiente.add(menu);
      }
      return siguiente;
    });

    try {
      localStorage.setItem(CLAVE_MENUS_ABIERTOS, JSON.stringify([...this.menusAbiertos()]));
    } catch {
      // Almacenamiento no disponible: el menú funciona igual, solo no se recuerda.
    }
  }
}

function leerMenusAbiertos(): string[] {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(CLAVE_MENUS_ABIERTOS) ?? '[]');
    return Array.isArray(guardado) ? guardado.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
