import { FuncionPlan } from 'src/app/sistema/membresias/suscripcion';

export interface OpcionMenu {
  icono: string;
  /** La pantalla depende del plan: sin la función, el menú muestra un candado con el plan desde el que está. */
  funcion?: FuncionPlan;
  etiqueta: string;
  /** Opcional en los grupos que solo despliegan `hijos`. */
  ruta?: string;
  esPro?: boolean;
  /** Si existe, muestra un badge con la cantidad. */
  notificaciones?: number;
  hijos?: OpcionMenu[];
}

/**
 * Menú principal. Al agregar una página nueva, registrar también su ruta
 * en el `*.routes.ts` del módulo correspondiente.
 */
export const MENU_OPERATIVO: OpcionMenu[] = [
  { icono: 'fa-solid fa-house', etiqueta: 'Inicio', ruta: '/inicio' },
  {
    icono: 'fa-solid fa-users',
    etiqueta: 'Personas',
    hijos: [
      { icono: 'fa-solid fa-user-graduate', etiqueta: 'Estudiantes', ruta: '/personas/estudiantes' },
      { icono: 'fa-solid fa-users', etiqueta: 'Acudientes', ruta: '/personas/acudientes' },
      { icono: 'fa-solid fa-user-tie', etiqueta: 'Empleados', ruta: '/personas/empleados' },
    ],
  },
  {
    icono: 'fa-solid fa-sack-dollar',
    etiqueta: 'Finanzas',
    hijos: [
      { icono: 'fa-solid fa-file-lines', etiqueta: 'Cotizaciones', ruta: '/finanzas/cotizaciones' },
      { icono: 'fa-solid fa-file-invoice-dollar', etiqueta: 'Facturas', ruta: '/finanzas/facturas' },
      { icono: 'fa-solid fa-receipt', etiqueta: 'Recibos', ruta: '/finanzas/recibos' },
      {
        icono: 'fa-solid fa-calendar-check',
        etiqueta: 'Programación de facturación',
        ruta: '/finanzas/programacion-facturacion',
        funcion: 'RECORDATORIOS',
      },
      { icono: 'fa-brands fa-whatsapp', etiqueta: 'Mensajes de WhatsApp', ruta: '/finanzas/mensajes-whatsapp' },
      {
        icono: 'fa-solid fa-chart-line',
        etiqueta: 'Reportes financieros',
        funcion: 'REPORTES',
        hijos: [
          { icono: 'fa-solid fa-dollar-sign', etiqueta: 'Ingresos', ruta: '/finanzas/reportes-financieros/ingresos' },
          {
            icono: 'fa-solid fa-clock',
            etiqueta: 'Facturas pendientes',
            ruta: '/finanzas/reportes-financieros/facturas-pendientes',
          },
          {
            icono: 'fa-solid fa-triangle-exclamation',
            etiqueta: 'Morosos',
            ruta: '/finanzas/reportes-financieros/morosos',
          },
        ],
      },
    ],
  },
  {
    icono: 'fa-solid fa-van-shuttle',
    etiqueta: 'Operación',
    hijos: [
      { icono: 'fa-solid fa-school', etiqueta: 'Colegios', ruta: '/operacion/colegios' },
      { icono: 'fa-solid fa-route', etiqueta: 'Rutas', ruta: '/operacion/rutas' },
      { icono: 'fa-solid fa-bus', etiqueta: 'Vehículos', ruta: '/operacion/vehiculos' },
      { icono: 'fa-solid fa-id-badge', etiqueta: 'Conductores', ruta: '/operacion/conductores' },
      { icono: 'fa-solid fa-diagram-project', etiqueta: 'Asignaciones', ruta: '/operacion/asignaciones' },
      { icono: 'fa-solid fa-clock-rotate-left', etiqueta: 'Recorridos', ruta: '/operacion/recorridos' },
      { icono: 'fa-solid fa-map-location-dot', etiqueta: 'Monitoreo en vivo', ruta: '/operacion/monitoreo', funcion: 'GPS_EN_VIVO' },
    ],
  },
];

export const MENU_SISTEMA: OpcionMenu[] = [
  { icono: 'fa-solid fa-headset', etiqueta: 'Centro de Ayuda', ruta: '/sistema/soporte' },
  { icono: 'fa-solid fa-crown', etiqueta: 'Planes y Membresías', ruta: '/sistema/membership' },
];
