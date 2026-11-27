import { Routes } from '@angular/router';

export default [
  {
    path: 'soporte',
    loadComponent: () => import('./soporte/soporte-page'),
    data: { breadcrumb: ['Sistema', 'Soporte'] },
  },
  {
    path: 'membership',
    loadComponent: () => import('./membresias/membresias-page'),
    data: { breadcrumb: ['Sistema', 'Planes y Membresías'] },
  },
  {
    path: 'publicidad',
    loadComponent: () => import('./publicidad/publicidad-page'),
    data: { breadcrumb: ['Sistema', 'Publicidad'] },
  },
  { path: '**', redirectTo: 'membership' },
] satisfies Routes;
