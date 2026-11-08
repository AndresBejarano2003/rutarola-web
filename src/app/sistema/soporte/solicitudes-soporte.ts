import { PrioridadTicket, TipoTicket } from './tickets/tickets';

/** Opciones del formulario "Crear solicitud" (los tickets viven en `tickets/`). */
export type TipoSolicitud = TipoTicket;
/** La prioridad CRÍTICA solo la asigna el equipo de soporte. */
export type PrioridadSolicitud = Exclude<PrioridadTicket, 'CRITICA'>;

export interface OpcionTipoSolicitud {
  id: TipoSolicitud;
  nombre: string;
  descripcion: string;
  icono: string;
  /** Guía que se muestra en la descripción según el tipo. */
  guia: string;
}

export const TIPOS_SOLICITUD: OpcionTipoSolicitud[] = [
  {
    id: 'ERROR',
    nombre: 'Reportar un error',
    descripcion: 'Algo no funciona como debería.',
    icono: 'fa-solid fa-bug',
    guia: '¿Qué estabas haciendo?, ¿qué esperabas que pasara? y ¿qué pasó en cambio? Incluye el mensaje de error si apareció.',
  },
  {
    id: 'CONSULTA',
    nombre: 'Hacer una consulta',
    descripcion: 'Tengo una duda sobre cómo usar el sistema.',
    icono: 'fa-solid fa-circle-question',
    guia: 'Cuéntanos qué quieres lograr y en qué pantalla estás.',
  },
  {
    id: 'MEJORA',
    nombre: 'Sugerir una mejora',
    descripcion: 'Una idea para que RutaRola sea mejor.',
    icono: 'fa-solid fa-lightbulb',
    guia: 'Describe la mejora y cómo te ayudaría en tu trabajo diario.',
  },
  {
    id: 'CAPACITACION',
    nombre: 'Pedir capacitación',
    descripcion: 'Quiero una sesión guiada para mi equipo.',
    icono: 'fa-solid fa-chalkboard-user',
    guia: 'Indica los temas, cuántas personas asistirían y en qué horario les queda mejor.',
  },
];

export const PRIORIDADES_SOLICITUD: { id: PrioridadSolicitud; nombre: string; descripcion: string }[] = [
  { id: 'BAJA', nombre: 'Baja', descripcion: 'Puede esperar' },
  { id: 'MEDIA', nombre: 'Media', descripcion: 'Afecta mi trabajo' },
  { id: 'ALTA', nombre: 'Alta', descripcion: 'No puedo operar' },
];
