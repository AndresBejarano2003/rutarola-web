import { Routes } from '@angular/router';

/** App del conductor/monitora (layout `shell-conductor`). */
export default [
  { path: '', loadComponent: () => import('./ruta-del-dia-page'), data: { breadcrumb: ['Ruta del día'] } },
  { path: 'recorrido/:id', loadComponent: () => import('./recorrido/recorrido-page'), data: { breadcrumb: ['Ruta del día', 'Recorrido'] } },
  { path: 'novedades', loadComponent: () => import('./novedades/novedades-page'), data: { breadcrumb: ['Ruta del día', 'Novedades del vehículo'] } },
  { path: 'cuenta', loadComponent: () => import('../autenticacion/cuenta/cuenta-page'), data: { breadcrumb: ['Mi cuenta'] } },
] satisfies Routes;
