import { OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { MENU_OPERATIVO, MENU_SISTEMA, OpcionMenu } from 'src/app/layout/menu-lateral/opciones-menu';

/**
 * Contenido del Centro de Ayuda: manuales, tutoriales y preguntas frecuentes.
 * Es el ÚNICO lugar donde se edita; las respuestas deben coincidir con las
 * rutas y reglas actuales de cada módulo (actualizarlas cuando un módulo cambie).
 */

export interface Manual {
  nombre: string;
  descripcion: string;
  icono: string;
  /** Ruta relativa a `public/`. */
  archivo: string;
}

export interface Tutorial {
  /** Id del video de YouTube. */
  videoId: string;
  titulo: string;
  descripcion: string;
  modulo: string;
}

export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
  modulo: string;
}

export const MANUALES: Manual[] = [
  {
    nombre: 'Manual general',
    descripcion: 'Recorrido completo por RutaRola y sus módulos.',
    icono: 'fa-solid fa-book',
    archivo: 'documentacion/manual-general.pdf',
  },
  {
    nombre: 'Gestión de estudiantes',
    descripcion: 'Registro, colegio, curso y acudientes de cada estudiante.',
    icono: 'fa-solid fa-user-graduate',
    archivo: 'documentacion/estudiantes.pdf',
  },
  {
    nombre: 'Gestión de acudientes',
    descripcion: 'Datos de contacto y estudiantes a cargo.',
    icono: 'fa-solid fa-people-roof',
    archivo: 'documentacion/acudientes.pdf',
  },
  {
    nombre: 'Finanzas y facturas',
    descripcion: 'Cotizaciones, facturas mensuales y recibos de pago.',
    icono: 'fa-solid fa-file-invoice-dollar',
    archivo: 'documentacion/finanzas.pdf',
  },
  {
    nombre: 'Rutas y operación',
    descripcion: 'Colegios, rutas, vehículos y asignaciones.',
    icono: 'fa-solid fa-route',
    archivo: 'documentacion/rutas.pdf',
  },
  {
    nombre: 'Programación de facturación',
    descripcion: 'Recordatorios automáticos por WhatsApp y correo.',
    icono: 'fa-solid fa-calendar-days',
    archivo: 'documentacion/facturacion.pdf',
  },
];

export const TUTORIALES: Tutorial[] = [
  {
    videoId: 'iIgsCYgo5P4',
    titulo: 'Recorrido por RutaRola',
    descripcion: 'Conoce los módulos principales y cómo se conectan entre sí.',
    modulo: 'General',
  },
  {
    videoId: 'lAoj2JTQtbQ',
    titulo: 'Primeros pasos',
    descripcion: 'Configura tu cuenta y registra la información inicial.',
    modulo: 'General',
  },
  {
    videoId: 'Jd5BdGRMzk8',
    titulo: 'Registrar estudiantes',
    descripcion: 'Crea estudiantes, asígnales colegio, curso y acudiente.',
    modulo: 'Personas',
  },
  {
    videoId: 'Ls1cOqGf7oI',
    titulo: 'Crear facturas (contrataciones)',
    descripcion: 'Define el valor mensual y los meses del servicio por estudiante.',
    modulo: 'Finanzas',
  },
  {
    videoId: 'PEVztafebuk',
    titulo: 'Facturación automática',
    descripcion: 'Programa recordatorios de pago por WhatsApp y correo.',
    modulo: 'Finanzas',
  },
];

export const PREGUNTAS_FRECUENTES: PreguntaFrecuente[] = [
  {
    modulo: 'Personas',
    pregunta: '¿Cómo registro un estudiante?',
    respuesta:
      'En Personas › Estudiantes presiona "Nuevo estudiante". El curso se elige entre los cursos activos del colegio seleccionado, así que primero el colegio debe tener sus cursos creados en Operación › Colegios.',
  },
  {
    modulo: 'Finanzas',
    pregunta: '¿Cómo creo una contratación o factura?',
    respuesta:
      'En Finanzas › Facturas presiona "Nueva factura", elige el acudiente y el estudiante e indica el valor mensual con el mes inicial y final. Un estudiante no puede tener dos facturas vigentes que se crucen en los mismos meses.',
  },
  {
    modulo: 'Finanzas',
    pregunta: '¿Cómo registro un pago?',
    respuesta:
      'En Finanzas › Recibos crea un recibo para la factura y el mes que se paga. Cada mes de una factura solo se puede pagar una vez; si te equivocaste, anula el recibo y crea uno nuevo.',
  },
  {
    modulo: 'Finanzas',
    pregunta: '¿Cómo funcionan los recordatorios automáticos de cobro?',
    respuesta:
      'Están incluidos desde el plan Esencial. En Finanzas › Programación de facturación configura, por factura, el día límite de pago, cuántos días antes avisar y el mensaje "En uso" de cada canal (WhatsApp o correo). El envío lo hace el servidor y queda en el historial; los mensajes de WhatsApp se consultan en Finanzas › Mensajes de WhatsApp. Si una factura no tiene programación, la cuota vence el día límite de pago de Inicio › Configuración (por defecto el 5).',
  },
  {
    modulo: 'Operación',
    pregunta: '¿Cómo asigno un vehículo y un conductor a una ruta?',
    respuesta:
      'En Operación › Asignaciones elige la ruta, el vehículo, el conductor y la monitora. El conductor debe tener la licencia vigente y el vehículo debe estar activo, con cupo suficiente y documentos al día.',
  },
  {
    modulo: 'Operación',
    pregunta: '¿Cómo ven los conductores y monitoras su ruta del día?',
    respuesta:
      'Ingresan con el usuario y la contraseña que se les asigna al crearlos en Personas › Empleados (sección "Acceso a la app") y el sistema los lleva a "Ruta del día" (no ven los módulos administrativos). Allí aparecen las rutas de sus asignaciones activas y vigentes; inician la recogida (casa → colegio) o la entrega (colegio → casa) y marcan a cada estudiante como recogido o entregado. En la recogida, "No asiste hoy" (no va al colegio: la entrega de ese día ya lo trae como ausente) o "Va por su cuenta" (sí asiste y regresa en la ruta); en la entrega, "No viaja". Si hay que cambiar el orden (por ejemplo, un acudiente avisa que recojan a su hijo de último), la monitora arrastra al estudiante a su nueva posición y el conductor ve el nuevo orden al instante con un aviso. Un recorrido solo se finaliza cuando ningún estudiante queda a bordo. El administrador los consulta en Operación › Recorridos.',
  },
  {
    modulo: 'Operación',
    pregunta: '¿Cómo veo dónde va un vehículo?',
    respuesta:
      'Mientras un recorrido está en curso, los teléfonos del conductor Y de la monitora comparten la ubicación desde la Ruta del día (si uno cierra la app o se apaga, el otro la mantiene al día): hay que permitir la ubicación en el navegador y mantener la pantalla encendida; sin señal, las ubicaciones se guardan y se envían al recuperarla. El administrador ve todos los vehículos en Operación › Monitoreo en vivo y el trayecto de cada recorrido en su detalle de Operación › Recorridos. El acudiente ve el vehículo en "Ver en el mapa" de su portal solo mientras la ruta de su estudiante está en curso y si la empresa lo permite: en Inicio › Configuración el administrador puede desactivar "Los acudientes ven la ubicación en vivo de la ruta"; entonces el acudiente solo ve el estado de su estudiante y la hora en que inició la ruta, y el administrador sigue viendo el monitoreo completo. Las ubicaciones se conservan 30 días. El GPS en vivo está incluido en los planes Profesional y Empresarial (y en la prueba gratuita).',
  },
  {
    modulo: 'Personas',
    pregunta: '¿Cómo consultan los acudientes sus facturas y pagos?',
    respuesta:
      'Ingresan con el usuario y la contraseña que se les asigna en Personas › Acudientes (sección "Acceso a la app") y el sistema los lleva al Portal del acudiente, donde solo ven su información: sus estudiantes (colegio, ruta, vehículo, conductor y monitora, y el estado de la ruta de hoy), sus facturas con el estado de cada mes (pagada, vencida, por pagar o programada), sus recibos y sus cotizaciones. El portal es de solo consulta. El usuario no puede repetirse entre empleados y acudientes.',
  },
  {
    modulo: 'General',
    pregunta: '¿Cómo cambio mi contraseña?',
    respuesta:
      'Entra a Mi cuenta (en el menú de tu usuario o el ícono de la persona con engranaje), escribe tu contraseña actual y la nueva dos veces (mínimo 6 caracteres). Se cierra la sesión en tus otros dispositivos. Si la olvidaste, el administrador te asigna una nueva en Personas.',
  },
  {
    modulo: 'General',
    pregunta: '¿Cómo pongo mi foto de perfil o cambio mi teléfono?',
    respuesta:
      'Entra a Mi cuenta y, en "Mis datos", toca "Subir foto" (desde el celular también puedes tomarla con la cámara), escribe tu teléfono de contacto y tu correo y guarda. La foto se recorta en un cuadrado y se ve en la barra superior y, para conductores, monitoras y acudientes, en las tablas de Personas, en el portal y en la Ruta del día del compañero. El administrador también puede cambiar su nombre; el nombre, el documento y el usuario de empleados y acudientes los corrige el administrador en Personas, donde además puede poner la foto de estudiantes, acudientes y empleados.',
  },
  {
    modulo: 'Sistema',
    pregunta: '¿Qué pasa con mi solicitud de soporte?',
    respuesta:
      'Cada solicitud es un ticket con número (SOP-0001) que sigues en "Mis solicitudes" de esta pantalla. Pasa por revisión, desarrollo, control de calidad (QA) y pruebas; los errores y mejoras además te piden validar la solución antes de resolverse. Te avisamos en la campana en cada avance; si te pedimos información, respóndela en el ticket. Cuando esté resuelto, confírmalo y califica la atención, o reábrelo si sigue fallando (si no respondes, se cierra solo a los 7 días). Puedes cancelarlo mientras no esté resuelto. También podemos agendarte una reunión: la verás en el ticket.',
  },
  {
    modulo: 'Sistema',
    pregunta: '¿Qué incluye mi plan y cómo lo pago?',
    respuesta:
      'Al registrarte tienes 3 meses gratis del plan Profesional. En Sistema › Planes y membresías ves cuántos días te quedan, cuántos vehículos y estudiantes activos usas y los planes Gratis, Esencial, Profesional y Empresarial (el anual tiene 2 meses gratis). Por ahora el plan se solicita desde Soporte: te enviamos los datos para pagar por transferencia y lo activamos apenas lo confirmemos (pronto podrás pagar en línea). Si la prueba o el plan vencen, pasas a Gratis sin perder datos: solo no podrás activar más vehículos o estudiantes que los del plan y se pausan el GPS en vivo y los recordatorios automáticos.',
  },
  {
    modulo: 'General',
    pregunta: '¿Por qué no puedo eliminar un registro?',
    respuesta:
      'Un registro que está en uso (por ejemplo, un acudiente con facturas o un vehículo asignado a una ruta) no se puede eliminar para no perder información. Cámbialo a estado Inactivo.',
  },
];

/** `true` si alguno de los textos contiene la búsqueda (sin tildes ni mayúsculas). */
export function coincideBusqueda(busqueda: string, ...textos: string[]): boolean {
  const buscado = normalizar(busqueda);
  return !buscado || textos.some((t) => normalizar(t).includes(buscado));
}

/** Pantallas del menú como opciones de "Módulo afectado" (se mantienen al día con el menú). */
export function modulosDelMenu(): OpcionCatalogo[] {
  const recorrer = (opciones: OpcionMenu[], prefijo: string[]): OpcionCatalogo[] =>
    opciones.flatMap((o) => {
      const camino = [...prefijo, o.etiqueta];
      return o.hijos ? recorrer(o.hijos, camino) : [{ id: camino.join(' › '), nombre: camino.join(' › ') }];
    });
  return [
    ...recorrer(MENU_OPERATIVO, []),
    ...recorrer(MENU_SISTEMA, ['Sistema']),
    { id: 'Otro', nombre: 'Otro / general' },
  ];
}
