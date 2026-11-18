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
      'En Personas › Estudiantes presiona "Nuevo estudiante". El curso se elige entre los cursos activos del colegio en la jornada del estudiante, así que primero el colegio debe tener sus cursos creados en Operación › Colegios ("Agregar cursos" crea un solo curso o todos hasta el grado más alto, en la jornada que elijas). Si el acudiente aún no existe, créalo ahí mismo con "Nuevo acudiente": se abre encima y lo que ya escribiste del estudiante no se pierde. Desde Personas › Acudientes, en el acudiente, "Agregar estudiante" crea sus estudiantes.',
  },
  {
    modulo: 'Personas',
    pregunta: '¿Qué pasa con las facturas si un estudiante o acudiente se retira?',
    respuesta:
      'Al cambiarlo a Inactivo, sus facturas vigentes registran el retiro: desde el mes siguiente (o después del último mes pagado) ya no se cobran los meses que faltan, no aparecen como pendientes ni en mora y no se envían recordatorios. También puedes registrar o quitar el retiro a mano en el detalle de la factura ("Registrar retiro"), eligiendo el mes desde el que deja de cobrar y el motivo; los meses ya pagados se conservan.',
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
      'En Finanzas › Recibos crea un recibo para la factura y elige cómo aplicarlo: "Pagar meses" (uno o varios meses) o "Abonar al saldo de la factura" (se aplica a los meses más antiguos). El valor se sugiere con el saldo de lo elegido. Si pagas menos, el sistema te avisa antes de guardar cuántas mensualidades quedan canceladas, cuánto se abona y a qué mes, y cuáles siguen pendientes: un mes solo queda pagado cuando se cubre su valor completo (si de 230.000 pagas 130.000, quedan 100.000 por pagar). No se puede pagar más que el saldo ni un mes ya pagado; si te equivocaste, anula el recibo y crea uno nuevo. El estado de cuenta de cada mes se ve en el detalle de la factura.',
  },
  {
    modulo: 'Finanzas',
    pregunta: '¿Cómo hago una cotización y la convierto en facturas?',
    respuesta:
      'En Finanzas › Cotizaciones presiona "Nueva cotización", elige un acudiente registrado o escribe los datos de un cliente nuevo, indica el mes inicial y final del servicio y agrega cada estudiante con su colegio y su valor mensual (pueden ser de colegios distintos y con valores distintos). El sistema suma el valor mensual y el total por los meses. En el detalle puedes enviarla por WhatsApp o por correo y, si el acudiente y los estudiantes están registrados, "Convertir en facturas": se aprueba y se crea una factura vigente por estudiante con su valor y los mismos meses. Una cotización facturada ya no se edita ni se elimina.',
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
      'En Operación › Asignaciones elige la ruta, el vehículo, el conductor y la monitora, el rango de fechas y, si quieres, un horario (hora de inicio y fin). Una ruta puede tener varias asignaciones (por ejemplo, un equipo en la mañana y otro en la tarde del mismo rango de fechas) mientras no se crucen en fechas y horas; tampoco un vehículo o una persona puede estar en dos rutas a la misma hora. Sin horario, la asignación ocupa toda la jornada de la ruta. El conductor debe tener la licencia vigente y el vehículo debe estar activo, con cupo suficiente y documentos al día. Al crear una ruta, el código se asigna solo y solo aparecen los estudiantes del colegio y la jornada de la ruta.',
  },
  {
    modulo: 'Operación',
    pregunta: '¿Cómo reporto una novedad del vehículo y llevo sus gastos?',
    respuesta:
      'El conductor o la monitora entra a Ruta del día › "Novedades del vehículo", elige el vehículo, el tipo (avería, daño, llantas, mantenimiento, limpieza, documentos u otro), la gravedad, describe lo que pasa y puede adjuntar una foto o PDF; los administradores reciben el aviso en la campana. El administrador la ve en el detalle del vehículo y la pasa a "En proceso" o "Resuelta" con su respuesta. En Operación › Vehículos también se registran los gastos (combustible con galones, mantenimiento, repuestos, llantas, peajes y más, con kilometraje y soporte) y el botón "Gastos" (o "Ver gastos" en el detalle de un vehículo) abre su tablero con totales por tipo y vehículo, promedio mensual, costo por kilómetro y kilómetros por galón.',
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
    modulo: 'Operación',
    pregunta: '¿Cómo avisa un acudiente que su estudiante no va a la ruta?',
    respuesta:
      'En su portal (Estudiantes o "Hoy en la ruta") el acudiente elige "Avisar ausencia", el día (hoy o hasta 30 días después) y qué pasa: "No asiste al colegio" (no viaja en ningún trayecto) o "Va por su cuenta" en la recogida, en la entrega o en ambas, con una nota opcional. Puede retirar el aviso mientras no lo confirmen. Durante el trayecto, el conductor y la monitora ven la alerta en Ruta del día con el nombre del estudiante, pueden llamar o escribir al acudiente y "Confirmar: no va" lo marca ausente. El administrador ve los avisos del día en Operación › Asignaciones y los de cualquier día en Operación › Cronograma.',
  },
  {
    modulo: 'Operación',
    pregunta: '¿Dónde veo la programación de la semana, el mes o el año?',
    respuesta:
      'En Operación › Cronograma (planes Profesional y Empresarial, y en la prueba gratuita). Cambia entre Semana, Mes y Año y avanza o retrocede con las flechas. Cada día muestra las rutas programadas (las activas con asignación vigente, de lunes a viernes), los recorridos realizados, las ausencias avisadas por los acudientes y la agenda: vencimiento de documentos de vehículos y licencias, fechas límite de pago, fin de contratos y de asignaciones (en rojo lo vencido). Al elegir un día ves cada ruta con su vehículo, conductor, monitora y el estado de la recogida y la entrega, quién no viaja y por qué; al tocar una ruta se abre su detalle con cada estudiante, su estado y la hora en que subió y llegó (o los programados si aún no sale), y accesos al monitoreo, al historial y a las asignaciones.',
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
      'Cada solicitud es un ticket con número (SOP-0001) que sigues en "Mis solicitudes" de esta pantalla. Pasa por revisión, desarrollo, control de calidad (QA) y pruebas; los errores y mejoras además te piden validar la solución antes de resolverse. Te avisamos en la campana en cada avance; si te pedimos información, respóndela en el ticket. Cuando esté resuelto, confírmalo y califica la atención, o reábrelo si sigue fallando (si no respondes, se cierra solo a los 7 días). Puedes cancelarlo mientras no esté resuelto. También podemos agendarte una reunión: la verás en el ticket. Nuestro equipo puede dejarte seguimientos (avances o preguntas) sin cambiar la etapa, y terminar el ticket explicando el motivo, por ejemplo si lleva 15 días esperando tu respuesta: la justificación queda en el historial.',
  },
  {
    modulo: 'Sistema',
    pregunta: '¿Qué incluye mi plan y cómo lo pago?',
    respuesta:
      'Al registrarte eliges cómo empezar: el plan Gratis (no vence: te quedas en él hasta que quieras mejorarlo; la insignia FREE de la barra superior te lo recuerda y lleva a los planes), probar gratis el plan Profesional (15 días, o los que tenga vigentes la plataforma ese día; tu prueba conserva los días con que empezó; si al terminar no pagas, quedas en Gratis) o pagar un plan de una vez. Si empezaste en Gratis puedes iniciar la prueba una sola vez desde Planes y membresías. Allí ves cuántos días te quedan, cuántos vehículos y estudiantes activos usas y los planes Gratis, Esencial, Profesional y Empresarial (el anual tiene 2 meses gratis). Por ahora el plan se solicita desde Soporte: te enviamos los datos para pagar por transferencia y lo activamos apenas lo confirmemos (pronto podrás pagar en línea). El plan o la prueba duran hasta el final de su último día: unos días antes (los que fije la plataforma) avisamos a todos los administradores de tu empresa en la campana y por correo. Si no pagas, al día siguiente del vencimiento tu empresa queda automáticamente en el plan Gratis: no pierdes datos, pero se desactivan las funciones de tu plan y se inactivan los vehículos y estudiantes que superen el límite (se conservan primero los que están en rutas); para activar otro, inactiva primero uno activo o mejora tu plan. Cuando pagues, el plan se activa de nuevo. Programación de cobros, reportes financieros, GPS en vivo y el cronograma solo están en los planes que los incluyen (el menú los muestra con candado).',
  },
  {
    modulo: 'Sistema',
    pregunta: '¿Cómo uso un código promocional?',
    respuesta:
      'En Sistema › Planes y membresías elige el plan, escribe el código en "¿Tienes un código promocional?" y pulsa Aplicar: verás el descuento y el total, o el motivo si no aplica (venció, es para otro plan o periodo, ya lo usaste…). El descuento es solo del primer mes que se factura; en el pago anual se descuenta una de las mensualidades y las renovaciones van a precio normal. Si el código cubre todo el primer pago, el plan se activa de inmediato. Mientras el pago en línea no esté disponible, "Solicitar por Soporte" envía tu solicitud con el código incluido y lo aplicamos al activar tu plan.',
  },
  {
    modulo: 'General',
    pregunta: '¿Por qué no puedo eliminar un registro?',
    respuesta:
      'Un registro que está en uso (por ejemplo, un acudiente con facturas, un vehículo asignado a una ruta o con gastos, o una cotización ya convertida en facturas) no se puede eliminar para no perder información. Cámbialo a estado Inactivo.',
  },
  {
    modulo: 'General',
    pregunta: '¿Tengo que recargar la página para ver datos nuevos?',
    respuesta:
      'No. Las tablas, reportes y el cronograma se actualizan solos cada minuto mientras tienes la pantalla abierta y visible, sin perder la página ni los filtros. Si cambias de pestaña o bloqueas el teléfono se detiene, y al volver se actualiza enseguida.',
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
