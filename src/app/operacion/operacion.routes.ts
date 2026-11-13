import { conFuncion } from 'src/app/core/plan-empresa';
import { Routes } from '@angular/router';

// Los repositorios (local / API) se eligen en `core/repositorios.ts`.
export default [
  {
    path: 'colegios',
    loadComponent: () => import('./colegios/colegios-page'),
    data: { breadcrumb: ['Operación', 'Colegios'] },
  },
  {
    path: 'rutas',
    loadComponent: () => import('./rutas/rutas-page'),
    data: { breadcrumb: ['Operación', 'Rutas'] },
  },
  {
    path: 'vehiculos',
    loadComponent: () => import('./vehiculos/vehiculos-page'),
    data: { breadcrumb: ['Operación', 'Vehículos'] },
  },
  {
    path: 'conductores',
    loadComponent: () => import('./conductores/conductores-page'),
    data: { breadcrumb: ['Operación', 'Conductores'] },
  },
  {
    path: 'asignaciones',
    loadComponent: () => import('./asignaciones/asignaciones-page'),
    data: { breadcrumb: ['Operación', 'Asignaciones'] },
  },
  {
    path: 'recorridos',
    loadComponent: () => import('./recorridos/recorridos-page'),
    data: { breadcrumb: ['Operación', 'Recorridos'] },
  },
  {
    path: 'monitoreo',
    canActivate: [conFuncion('GPS_EN_VIVO')],
    loadComponent: () => import('./monitoreo/monitoreo-page'),
    data: { breadcrumb: ['Operación', 'Monitoreo en vivo'] },
  },
  { path: '**', redirectTo: 'colegios' },
] satisfies Routes;
