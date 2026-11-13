import { conFuncion } from 'src/app/core/plan-empresa';
import { Routes } from '@angular/router';

// Los repositorios (local / API) se eligen en `core/repositorios.ts`.
export default [
  {
    path: 'cotizaciones',
    loadComponent: () => import('./cotizaciones/cotizaciones-page'),
    data: { breadcrumb: ['Finanzas', 'Cotizaciones'] },
  },
  {
    path: 'facturas',
    loadComponent: () => import('./facturas/facturas-page'),
    data: { breadcrumb: ['Finanzas', 'Facturas'] },
  },
  // Nombre anterior de la sección.
  { path: 'contrataciones', redirectTo: 'facturas' },
  {
    path: 'recibos',
    loadComponent: () => import('./recibos/recibos-page'),
    data: { breadcrumb: ['Finanzas', 'Recibos'] },
  },
  {
    path: 'programacion-facturacion',
    loadComponent: () => import('./programacion/programacion-page'),
    data: { breadcrumb: ['Finanzas', 'Programación de facturación'] },
  },
  {
    path: 'mensajes-whatsapp',
    loadComponent: () => import('./mensajes-whatsapp/mensajes-whatsapp-page'),
    data: { breadcrumb: ['Finanzas', 'Mensajes de WhatsApp'] },
  },
  {
    path: 'reportes-financieros',
    canActivate: [conFuncion('REPORTES')],
    children: [
      {
        path: 'ingresos',
        loadComponent: () => import('./reportes/ingresos/reporte-ingresos-page'),
        data: { breadcrumb: ['Finanzas', 'Reportes financieros', 'Ingresos'] },
      },
      {
        path: 'facturas-pendientes',
        loadComponent: () => import('./reportes/facturas-pendientes/reporte-pendientes-page'),
        data: { breadcrumb: ['Finanzas', 'Reportes financieros', 'Facturas pendientes'] },
      },
      {
        path: 'morosos',
        loadComponent: () => import('./reportes/morosos/reporte-morosos-page'),
        data: { breadcrumb: ['Finanzas', 'Reportes financieros', 'Morosos'] },
      },
      { path: '**', redirectTo: 'ingresos' },
    ],
  },
  { path: '**', redirectTo: 'cotizaciones' },
] satisfies Routes;
