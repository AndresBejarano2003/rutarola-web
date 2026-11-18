import { Routes } from '@angular/router';

/** Plataforma RutaRola (SUPER_ADMIN, layout `shell-plataforma`): ingresos (inicio), empresas, códigos promocionales, ajustes globales (prueba, avisos, precios) y tickets de soporte. */
export default [
  { path: '', pathMatch: 'full', redirectTo: 'ingresos' },
  { path: 'ingresos', loadComponent: () => import('./ingresos/ingresos-page'), data: { breadcrumb: ['Plataforma', 'Ingresos'] } },
  { path: 'empresas', loadComponent: () => import('./empresas/empresas-page'), data: { breadcrumb: ['Plataforma', 'Empresas'] } },
  {
    path: 'codigos-promocionales',
    loadComponent: () => import('./codigos-promocionales/codigos-promocionales-page'),
    data: { breadcrumb: ['Plataforma', 'Códigos promocionales'] },
  },
  { path: 'ajustes', loadComponent: () => import('./ajustes/ajustes-plataforma-page'), data: { breadcrumb: ['Plataforma', 'Ajustes'] } },
  { path: 'soporte', loadComponent: () => import('./soporte/soporte-plataforma-page'), data: { breadcrumb: ['Plataforma', 'Soporte'] } },
  { path: 'cuenta', loadComponent: () => import('../autenticacion/cuenta/cuenta-page'), data: { breadcrumb: ['Plataforma', 'Mi cuenta'] } },
  { path: '**', redirectTo: 'empresas' },
] satisfies Routes;
