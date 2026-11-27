import { Routes } from '@angular/router';
import { CuentasUnidasEstado } from '../autenticacion/cuenta/cuentas-unidas/cuentas-unidas-estado';
import { PortalEstado } from './portal-estado';

/** Portal del acudiente (layout `shell-portal`, solo lectura). */
export default [
  {
    path: '',
    providers: [PortalEstado, CuentasUnidasEstado],
    loadComponent: () => import('../layout/shell-portal/shell-portal'),
    children: [
      { path: '', loadComponent: () => import('./inicio/portal-inicio-page'), data: { breadcrumb: ['Inicio'] } },
      { path: 'estudiantes', loadComponent: () => import('./estudiantes/portal-estudiantes-page'), data: { breadcrumb: ['Mis estudiantes'] } },
      { path: 'pagos', loadComponent: () => import('./pagos/portal-pagos-page'), data: { breadcrumb: ['Facturas y pagos'] } },
      { path: 'cotizaciones', loadComponent: () => import('./cotizaciones/portal-cotizaciones-page'), data: { breadcrumb: ['Cotizaciones'] } },
      { path: 'cuenta', loadComponent: () => import('../autenticacion/cuenta/cuenta-page'), data: { breadcrumb: ['Mi cuenta'] } },
      { path: '**', redirectTo: '' },
    ],
  },
] satisfies Routes;
